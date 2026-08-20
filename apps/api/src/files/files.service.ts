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
  versionId: string;
}

// Enforced in the upload token itself, so the blob store rejects an
// oversized file even if the request never went through our UI. The
// frontend checks the same limit first, but only to fail fast with a
// nicer message — this is the one that actually binds.
const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

// Capped rather than paginated: search is a "jump to the file I mean" tool,
// and a query matching more than this many files is one worth narrowing.
const SEARCH_RESULT_LIMIT = 50;

// Prisma's `contains` becomes an ILIKE with the value interpolated between
// two wildcards, and it does not escape LIKE metacharacters — so a query of
// "%" would match every file and "_" would match any single character.
// That's not an injection (the value is still bound as a parameter), just a
// search that lies. Escaping makes them match literally, which is what
// someone typing them into a search box means. Postgres LIKE treats
// backslash as the escape character by default, so no ESCAPE clause needed.
const escapeLikeMetacharacters = (value: string) =>
  value.replace(/[\\%_]/g, (character) => `\\${character}`);

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

  private async assertDataRoomOwnership(ownerId: string, dataRoomId: string) {
    const dataRoom = await this.prisma.dataRoom.findFirst({
      where: { id: dataRoomId, ownerId },
    });
    if (!dataRoom) {
      throw new NotFoundException('Data room not found');
    }
  }

  private async getOwnedFile(ownerId: string, dataRoomId: string, fileId: string) {
    await this.assertDataRoomOwnership(ownerId, dataRoomId);
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

  // Search spans the whole data room, not the open folder — a due-diligence
  // reviewer looking for "Q3 financials" doesn't know which folder it was
  // filed under, which is the entire point of searching.
  //
  // `contains` compiles to an unindexed ILIKE '%q%' scan. That is the right
  // trade-off at this size (a data room holds hundreds of files, not
  // millions) and deliberately avoids a migration; README "How it scales"
  // records the pg_trgm GIN index this becomes when the scan stops being
  // free.
  async search(ownerId: string, dataRoomId: string, query: string) {
    await this.assertDataRoomOwnership(ownerId, dataRoomId);

    // One folder fetch instead of walking each result's ancestor chain
    // separately: a data room's folder count is small, and building the
    // paths in memory keeps this at two queries no matter how many files
    // match.
    const [files, folders] = await Promise.all([
      this.prisma.file.findMany({
        where: {
          dataRoomId,
          // A document with no current version is one whose first upload
          // never completed — the equivalent of the old status = READY test.
          currentVersionId: { not: null },
          name: {
            contains: escapeLikeMetacharacters(query),
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          name: true,
          folderId: true,
          currentVersion: { select: { sizeBytes: true } },
        },
        orderBy: { name: 'asc' },
        take: SEARCH_RESULT_LIMIT,
      }),
      this.prisma.folder.findMany({
        where: { dataRoomId },
        select: { id: true, name: true, parentId: true },
      }),
    ]);

    const foldersById = new Map(folders.map((folder) => [folder.id, folder]));

    const buildPath = (folderId: string | null) => {
      const path: { id: string; name: string }[] = [];
      let currentId = folderId;
      while (currentId) {
        const folder = foldersById.get(currentId);
        if (!folder) break;
        path.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parentId;
      }
      return path;
    };

    // Flattened back to the shape the client already consumes: a search
    // result is about the document, and its size is that of what you'd get
    // by opening it.
    return files.map(({ currentVersion, ...file }) => ({
      ...file,
      sizeBytes: currentVersion?.sizeBytes ?? 0n,
      path: buildPath(file.folderId),
    }));
  }

  // Blob access is 'private', so the stored URL isn't fetchable directly —
  // this proxies the content through our own auth instead of handing out a
  // signed URL, keeping the same JwtAuthGuard check as everything else.
  // versionId is optional: without it the caller gets whatever is current,
  // which is what listings and share links want. The version history passes
  // one explicitly to open an older revision.
  async streamContent(
    userId: string,
    dataRoomId: string,
    fileId: string,
    res: Response,
    versionId?: string,
  ) {
    // Asking for a specific revision is part of the history, so it takes
    // ownership. Sharing grants the current version of a document, not
    // everything it used to say.
    if (versionId) {
      await this.getOwnedFile(userId, dataRoomId, fileId);
    } else {
      await this.getAccessibleFile(userId, dataRoomId, fileId);
    }

    const version = versionId
      ? await this.prisma.fileVersion.findFirst({ where: { id: versionId, fileId } })
      : await this.prisma.fileVersion.findFirst({ where: { currentOf: { id: fileId } } });

    if (!version || version.status !== 'READY') {
      throw new NotFoundException('File not found');
    }
    const result = await get(version.storageKey, { access: 'private' });
    if (!result || result.statusCode !== 200) {
      throw new NotFoundException('File not found');
    }
    const file = await this.prisma.file.findUniqueOrThrow({ where: { id: fileId } });
    res.setHeader('Content-Type', version.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    Readable.fromWeb(result.stream as unknown as NodeReadableStream).pipe(res);
  }

  // Owner-only, unlike viewing. Replacing a version is a normal way to take
  // something out of a document, so whoever a file is shared with must not
  // be able to enumerate what it replaced.
  async listVersions(ownerId: string, dataRoomId: string, fileId: string) {
    const file = await this.getOwnedFile(ownerId, dataRoomId, fileId);
    const versions = await this.prisma.fileVersion.findMany({
      where: { fileId, status: 'READY' },
      select: {
        id: true,
        versionNumber: true,
        sizeBytes: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
      },
      orderBy: { versionNumber: 'desc' },
    });
    return versions.map((version) => ({
      ...version,
      uploadedBy: version.uploadedBy.name,
      isCurrent: version.id === file.currentVersionId,
    }));
  }

  async remove(ownerId: string, dataRoomId: string, fileId: string) {
    await this.getOwnedFile(ownerId, dataRoomId, fileId);
    // Every version has its own blob, so deleting the document means
    // deleting all of them. A version stuck in PENDING never got a real blob
    // (storageKey is still the placeholder), so it has nothing to remove.
    const versions = await this.prisma.fileVersion.findMany({
      where: { fileId, status: 'READY' },
      select: { storageKey: true },
    });
    await Promise.all(versions.map((version) => del(version.storageKey)));
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

        // Uploading over an existing name adds a version to that document
        // rather than creating "Report (1).pdf" beside it. Which of the two
        // happens is decided here, by whether the name is already taken in
        // this folder.
        const existing = await this.prisma.file.findFirst({
          where: { dataRoomId, folderId: folderId ?? null, name: pathname },
          include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
        });

        const version = existing
          ? await this.prisma.fileVersion.create({
              data: {
                fileId: existing.id,
                versionNumber: (existing.versions[0]?.versionNumber ?? 0) + 1,
                sizeBytes: 0,
                mimeType: 'application/pdf',
                // Placeholder until onUploadCompleted swaps in the real blob
                // URL — storageKey is unique, so it can't be blank meanwhile.
                storageKey: `pending:${randomUUID()}`,
                uploadedById: userId,
                status: 'PENDING',
              },
            })
          : await this.prisma.fileVersion.create({
              data: {
                versionNumber: 1,
                sizeBytes: 0,
                mimeType: 'application/pdf',
                storageKey: `pending:${randomUUID()}`,
                status: 'PENDING',
                uploadedBy: { connect: { id: userId } },
                file: {
                  create: {
                    name: pathname,
                    dataRoomId,
                    folderId: folderId ?? null,
                    createdById: userId,
                  },
                },
              },
            });

        const payload: UploadTokenPayload = { versionId: version.id };
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: MAX_UPLOAD_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(payload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) return;
        const { versionId } = JSON.parse(tokenPayload) as UploadTokenPayload;
        // PutBlobResult doesn't include size — head() gets the authoritative
        // value from the store rather than trusting a client-supplied one.
        const info = await head(blob.url);
        // Promoting the version to "current" is what publishes the upload:
        // until this runs the document either doesn't appear at all (first
        // upload) or still serves its previous version. Both happen together
        // so a listing can never see a half-written version.
        const version = await this.prisma.fileVersion.update({
          where: { id: versionId },
          data: {
            storageKey: blob.url,
            sizeBytes: info.size,
            mimeType: blob.contentType,
            status: 'READY',
          },
        });
        await this.prisma.file.update({
          where: { id: version.fileId },
          data: { currentVersionId: version.id },
        });
      },
    });
  }
}
