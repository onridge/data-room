import { Injectable, NotFoundException } from '@nestjs/common';
import { ShareResourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDataRoomDto } from './dto/create-data-room.dto';
import { UpdateDataRoomDto } from './dto/update-data-room.dto';
import { ShareAccessService } from '../shares/share-access.service';

@Injectable()
export class DataRoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shareAccess: ShareAccessService,
  ) {}

  async create(ownerId: string, dto: CreateDataRoomDto) {
    return this.prisma.dataRoom.create({ data: { name: dto.name, ownerId } });
  }

  async findAllForOwner(ownerId: string) {
    return this.prisma.dataRoom.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Not-found and not-owned both surface as 404 — an owner shouldn't be able
  // to tell the difference between "doesn't exist" and "exists, not yours".
  async findOneOwned(ownerId: string, id: string) {
    const dataRoom = await this.prisma.dataRoom.findFirst({ where: { id, ownerId } });
    if (!dataRoom) {
      throw new NotFoundException('Data room not found');
    }
    return dataRoom;
  }

  // Owner or shared-with-read-access — used by view-only endpoints. Write
  // endpoints (rename, delete, create-folder, upload, ...) stay on the
  // strict findOneOwned above; sharing is read-only per the spec.
  async findOneAccessible(userId: string, id: string) {
    const dataRoom = await this.prisma.dataRoom.findUnique({ where: { id } });
    if (!dataRoom) {
      throw new NotFoundException('Data room not found');
    }
    if (dataRoom.ownerId !== userId) {
      const allowed = await this.shareAccess.canRead(userId, ShareResourceType.DATA_ROOM, id);
      if (!allowed) {
        throw new NotFoundException('Data room not found');
      }
    }
    return dataRoom;
  }

  async rename(ownerId: string, id: string, dto: UpdateDataRoomDto) {
    await this.findOneOwned(ownerId, id);
    return this.prisma.dataRoom.update({ where: { id }, data: { name: dto.name } });
  }

  async remove(ownerId: string, id: string) {
    await this.findOneOwned(ownerId, id);
    await this.prisma.dataRoom.delete({ where: { id } });
  }

  // Powers the delete-confirmation warning — every folder/file already
  // stores its own dataRoomId regardless of nesting depth, so this is a
  // flat query rather than the recursive CTE folder deletion needs.
  async getSummary(ownerId: string, id: string) {
    await this.findOneOwned(ownerId, id);

    const [folders, files] = await Promise.all([
      this.prisma.folder.findMany({ where: { dataRoomId: id }, select: { id: true } }),
      this.prisma.file.findMany({
        where: { dataRoomId: id },
        select: { id: true, currentVersion: { select: { sizeBytes: true } } },
      }),
    ]);
    // Counts what deleting actually frees from the user's point of view —
    // the current version of each document. Superseded versions still
    // occupy blob storage, but reporting their total here would make the
    // warning read as much larger than what the user can see.
    const totalSizeBytes = files.reduce(
      (sum, file) => sum + (file.currentVersion?.sizeBytes ?? 0n),
      0n,
    );

    const activeShareCount = await this.prisma.share.count({
      where: {
        revokedAt: null,
        OR: [
          { resourceType: ShareResourceType.DATA_ROOM, resourceId: id },
          { resourceType: ShareResourceType.FOLDER, resourceId: { in: folders.map((f) => f.id) } },
          { resourceType: ShareResourceType.FILE, resourceId: { in: files.map((f) => f.id) } },
        ],
      },
    });

    return {
      folderCount: folders.length,
      fileCount: files.length,
      totalSizeBytes: totalSizeBytes.toString(),
      activeShareCount,
    };
  }

  // folderId omitted/undefined = the data room's own root, not "any folder".
  // Access is checked against the specific node being viewed, not always
  // the data room — a share on just one folder shouldn't require a
  // data-room-level share to browse into it.
  async getContents(userId: string, dataRoomId: string, folderId?: string) {
    if (folderId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: folderId, dataRoomId },
      });
      if (!folder) {
        throw new NotFoundException('Folder not found');
      }
      const allowed = await this.shareAccess.canRead(userId, ShareResourceType.FOLDER, folderId);
      if (!allowed) {
        throw new NotFoundException('Folder not found');
      }
    } else {
      await this.findOneAccessible(userId, dataRoomId);
    }

    const [folders, files] = await Promise.all([
      this.prisma.folder.findMany({
        where: { dataRoomId, parentId: folderId ?? null },
        orderBy: { name: 'asc' },
      }),
      this.prisma.file.findMany({
        where: { dataRoomId, folderId: folderId ?? null, currentVersionId: { not: null } },
        include: { currentVersion: { select: { sizeBytes: true, versionNumber: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);

    // The client still sees a flat file with a size; versionNumber rides
    // along so the listing can mark documents that have been superseded.
    return {
      folders,
      files: files.map(({ currentVersion, ...file }) => ({
        ...file,
        sizeBytes: currentVersion?.sizeBytes ?? 0n,
        versionNumber: currentVersion?.versionNumber ?? 1,
      })),
    };
  }
}
