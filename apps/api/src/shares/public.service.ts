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
    return { resourceType: share.resourceType, resourceId: share.resourceId, name };
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

    const [folders, files] = await Promise.all([
      this.prisma.folder.findMany({
        where: { dataRoomId, parentId: targetFolderId ?? null },
        orderBy: { name: 'asc' },
      }),
      this.prisma.file.findMany({
        where: { dataRoomId, folderId: targetFolderId ?? null, status: FileStatus.READY },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { folders, files };
  }

  async streamFileContent(token: string, fileId: string, res: Response) {
    const share = await this.shareAccess.resolvePublicShare(token);
    const within = await this.shareAccess.isWithinShare(share, ShareResourceType.FILE, fileId);
    if (!within) {
      throw new NotFoundException('File not found');
    }
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.status !== FileStatus.READY) {
      throw new NotFoundException('File not found');
    }
    const result = await get(file.storageKey, { access: 'private' });
    if (!result || result.statusCode !== 200) {
      throw new NotFoundException('File not found');
    }
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    Readable.fromWeb(result.stream as unknown as NodeReadableStream).pipe(res);
  }
}
