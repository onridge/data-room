import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { IncomingMessage } from 'node:http';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, ShareResourceType } from '@prisma/client';
import { del, get, head } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import type { HandleUploadBody } from '@vercel/blob/client';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { getJwtSecret } from '../auth/jwt-secret.util';
import { UpdateFileDto } from './dto/update-file.dto';
import { MoveFileDto } from './dto/move-file.dto';
import { ShareAccessService } from '../shares/share-access.service';

interface UploadTokenPayload {
  fileId: string;
}

// Enforced in the upload token itself, so the blob store rejects an
// oversized file even if the request never went through our UI. The
// frontend checks the same limit first, but only to fail fast with a
// nicer message — this is the one that actually binds.
const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly shareAccess: ShareAccessService,
  ) {}

  // handleUpload runs two very different calls through this same function:
  // (1) our own frontend, with our JWT, asking permission to upload — auth
  //     is checked by hand below since this route can't sit behind
  //     JwtAuthGuard.
  // (2) Vercel's own infrastructure notifying us the upload finished — that
  //     call carries no JWT at all, it's verified by the SDK itself against
  //     BLOB_READ_WRITE_TOKEN.
  private verifyRequester(request: IncomingMessage): string {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = this.jwt.verify<{ sub: string }>(token, {
        secret: getJwtSecret(),
      });
      return payload.sub;
    } catch {
      throw new UnauthorizedException();
    }
  }

  // Drive-style auto-rename on conflict ("Report.pdf" -> "Report (1).pdf")
  // — uploads happen in a batch with no per-file prompt, unlike the
  // explicit rename endpoint which can just reject with 409.
  private async resolveName(
    dataRoomId: string,
    folderId: string | null,
    desired: string,
  ) {
    const dotIndex = desired.lastIndexOf('.');
    const base = dotIndex > 0 ? desired.slice(0, dotIndex) : desired;
    const ext = dotIndex > 0 ? desired.slice(dotIndex) : '';

    let candidate = desired;
    let attempt = 1;
    for (;;) {
      const existing = await this.prisma.file.findFirst({
        where: { dataRoomId, folderId, name: candidate },
      });
      if (!existing) return candidate;
      candidate = `${base} (${attempt})${ext}`;
      attempt += 1;
    }
  }

  private async getOwnedFile(ownerId: string, dataRoomId: string, fileId: string) {
    const dataRoom = await this.prisma.dataRoom.findFirst({
      where: { id: dataRoomId, ownerId },
    });
    if (!dataRoom) {
      throw new NotFoundException('Data room not found');
    }
    const file = await this.prisma.file.findFirst({ where: { id: fileId, dataRoomId } });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  // Owner or shared-with-read-access — used by streamContent (viewing).
  // Write ops above stay on the strict getOwnedFile; sharing is read-only
  // per the spec.
  private async getAccessibleFile(userId: string, dataRoomId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({ where: { id: fileId, dataRoomId } });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    const allowed = await this.shareAccess.canRead(userId, ShareResourceType.FILE, fileId);
    if (!allowed) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  async rename(ownerId: string, dataRoomId: string, fileId: string, dto: UpdateFileDto) {
    await this.getOwnedFile(ownerId, dataRoomId, fileId);
    try {
      return await this.prisma.file.update({
        where: { id: fileId },
        data: { name: dto.name },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A file with this name already exists here');
      }
      throw error;
    }
  }

  async move(ownerId: string, dataRoomId: string, fileId: string, dto: MoveFileDto) {
    await this.getOwnedFile(ownerId, dataRoomId, fileId);
    if (dto.folderId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: dto.folderId, dataRoomId },
      });
      if (!folder) {
        throw new NotFoundException('Folder not found');
      }
    }
    try {
      return await this.prisma.file.update({
        where: { id: fileId },
        data: { folderId: dto.folderId ?? null },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A file with this name already exists in that folder');
      }
      throw error;
    }
  }

  // Blob access is 'private', so the stored URL isn't fetchable directly —
  // this proxies the content through our own auth instead of handing out a
  // signed URL, keeping the same JwtAuthGuard check as everything else.
  async streamContent(userId: string, dataRoomId: string, fileId: string, res: Response) {
    const file = await this.getAccessibleFile(userId, dataRoomId, fileId);
    if (file.status !== 'READY') {
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

  async remove(ownerId: string, dataRoomId: string, fileId: string) {
    const file = await this.getOwnedFile(ownerId, dataRoomId, fileId);
    // A file stuck in PENDING never got a real blob (storageKey is still the
    // placeholder), so there's nothing to delete from the store.
    if (file.status === 'READY') {
      await del(file.storageKey);
    }
    await this.prisma.file.delete({ where: { id: fileId } });
  }

  async handleUploadRequest(
    request: IncomingMessage,
    body: HandleUploadBody,
    dataRoomId: string,
    folderId: string | undefined,
  ) {
    return handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const userId = this.verifyRequester(request);

        const dataRoom = await this.prisma.dataRoom.findFirst({
          where: { id: dataRoomId, ownerId: userId },
        });
        if (!dataRoom) {
          throw new NotFoundException('Data room not found');
        }
        if (folderId) {
          const folder = await this.prisma.folder.findFirst({
            where: { id: folderId, dataRoomId },
          });
          if (!folder) {
            throw new NotFoundException('Folder not found');
          }
        }

        const finalName = await this.resolveName(
          dataRoomId,
          folderId ?? null,
          pathname,
        );

        const file = await this.prisma.file.create({
          data: {
            name: finalName,
            sizeBytes: 0,
            mimeType: 'application/pdf',
            // Placeholder until onUploadCompleted swaps in the real blob URL —
            // storageKey is unique, so it can't be left blank in the meantime.
            storageKey: `pending:${randomUUID()}`,
            dataRoomId,
            folderId: folderId ?? null,
            uploadedById: userId,
            status: 'PENDING',
          },
        });

        const payload: UploadTokenPayload = { fileId: file.id };
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: MAX_UPLOAD_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(payload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) return;
        const { fileId } = JSON.parse(tokenPayload) as UploadTokenPayload;
        // PutBlobResult doesn't include size — head() gets the authoritative
        // value from the store rather than trusting a client-supplied one.
        const info = await head(blob.url);
        await this.prisma.file.update({
          where: { id: fileId },
          data: {
            storageKey: blob.url,
            sizeBytes: info.size,
            mimeType: blob.contentType,
            status: 'READY',
          },
        });
      },
    });
  }
}
