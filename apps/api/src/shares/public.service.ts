import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { Injectable, NotFoundException } from '@nestjs/common';
import { FileStatus, ShareResourceType } from '@prisma/client';
import { get } from '@vercel/blob';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ShareAccessService } from './share-access.service';

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shareAccess: ShareAccessService,
  ) {}

  async getShareInfo(token: string) {
    const share = await this.shareAccess.resolvePublicShare(token);
    const name = await this.shareAccess.resolveResourceName(share.resourceType, share.resourceId);
    if (!name) {
      throw new NotFoundException('Shared item not found');
    }
    const owner = await this.prisma.user.findUnique({
      where: { id: share.createdById },
      select: { name: true },
    });
    return {
      resourceType: share.resourceType,
      resourceId: share.resourceId,
      name,
      ownerName: owner?.name ?? 'Unknown',
      sharedAt: share.createdAt,
    };
  }

  // folderId omitted = the share's own root: itself if it's a Folder share,
  // or the data room's root if it's a Data Room share. A File share has no
  // contents to list at all.
  async getContents(token: string, folderId?: string) {
    const share = await this.shareAccess.resolvePublicShare(token);
    if (share.resourceType === ShareResourceType.FILE) {
      throw new NotFoundException('Folder not found');
    }
    const dataRoomId = await this.shareAccess.resolveDataRoomId(share.resourceType, share.resourceId);
    if (!dataRoomId) {
      throw new NotFoundException('Shared item not found');
    }

    const targetFolderId =
      folderId ?? (share.resourceType === ShareResourceType.FOLDER ? share.resourceId : undefined);

    if (targetFolderId) {
      const within = await this.shareAccess.isWithinShare(
        share,
        ShareResourceType.FOLDER,
        targetFolderId,
      );
      if (!within) {
        throw new NotFoundException('Folder not found');
      }
    }

    // Deliberately narrow: this response goes to anonymous callers, so it
    // returns only what the public view renders. The full rows would also
    // hand out storageKey (the blob URL) and the internal user ids behind
    // uploadedById / createdById.
    const [folders, files] = await Promise.all([
      this.prisma.folder.findMany({
        where: { dataRoomId, parentId: targetFolderId ?? null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.file.findMany({
        where: { dataRoomId, folderId: targetFolderId ?? null, currentVersionId: { not: null } },
        select: { id: true, name: true, currentVersion: { select: { sizeBytes: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);

    // Version history is owner-only — a public visitor sees the current
    // document and nothing about what it replaced.
    return {
      folders,
      files: files.map(({ currentVersion, ...file }) => ({
        ...file,
        sizeBytes: currentVersion?.sizeBytes ?? 0n,
      })),
    };
  }

  async streamFileContent(token: string, fileId: string, res: Response) {
    const share = await this.shareAccess.resolvePublicShare(token);
    const within = await this.shareAccess.isWithinShare(share, ShareResourceType.FILE, fileId);
    if (!within) {
      throw new NotFoundException('File not found');
    }
    // Always the current version: a public link points at the document, and
    // following it should never expose a revision the owner has replaced.
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { currentVersion: true },
    });
    if (!file?.currentVersion || file.currentVersion.status !== FileStatus.READY) {
      throw new NotFoundException('File not found');
    }
    const result = await get(file.currentVersion.storageKey, { access: 'private' });
    if (!result || result.statusCode !== 200) {
      throw new NotFoundException('File not found');
    }
    res.setHeader('Content-Type', file.currentVersion.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    Readable.fromWeb(result.stream as unknown as NodeReadableStream).pipe(res);
  }
}
