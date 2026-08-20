import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ShareResourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { ShareAccessService } from '../shares/share-access.service';

interface SubtreeSummaryRow {
  subfolderCount: number;
  fileCount: number;
  totalSizeBytes: bigint;
  activeShareCount: number;
}

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shareAccess: ShareAccessService,
  ) {}

  private async assertDataRoomOwnership(ownerId: string, dataRoomId: string) {
    const dataRoom = await this.prisma.dataRoom.findFirst({
      where: { id: dataRoomId, ownerId },
    });
    if (!dataRoom) {
      throw new NotFoundException('Data room not found');
    }
  }

  private async getOwnedFolder(ownerId: string, dataRoomId: string, folderId: string) {
    await this.assertDataRoomOwnership(ownerId, dataRoomId);
    const folder = await this.prisma.folder.findFirst({ where: { id: folderId, dataRoomId } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    return folder;
  }

  // Flat list for the "move to" picker — the frontend builds the indented
  // tree itself from parentId, same as it already does for the breadcrumb.
  async findAll(ownerId: string, dataRoomId: string) {
    await this.assertDataRoomOwnership(ownerId, dataRoomId);
    return this.prisma.folder.findMany({
      where: { dataRoomId },
      orderBy: { name: 'asc' },
    });
  }

  async create(ownerId: string, dataRoomId: string, dto: CreateFolderDto) {
    await this.assertDataRoomOwnership(ownerId, dataRoomId);
    if (dto.parentId) {
      // Confirms the parent both exists and belongs to this data room —
      // otherwise you could nest a folder under someone else's tree.
      await this.getOwnedFolder(ownerId, dataRoomId, dto.parentId);
    }

    try {
      return await this.prisma.folder.create({
        data: {
          name: dto.name,
          dataRoomId,
          parentId: dto.parentId ?? null,
          createdById: ownerId,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A folder with this name already exists here');
      }
      throw error;
    }
  }

  // Owner or shared-with-read-access — write ops below stay on the strict
  // getOwnedFolder; sharing is read-only per the spec.
  private async getAccessibleFolder(userId: string, dataRoomId: string, folderId: string) {
    const folder = await this.prisma.folder.findFirst({ where: { id: folderId, dataRoomId } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    const allowed = await this.shareAccess.canRead(userId, ShareResourceType.FOLDER, folderId);
    if (!allowed) {
      throw new NotFoundException('Folder not found');
    }
    return folder;
  }

  async findOne(userId: string, dataRoomId: string, folderId: string) {
    return this.getAccessibleFolder(userId, dataRoomId, folderId);
  }

  async rename(ownerId: string, dataRoomId: string, folderId: string, dto: UpdateFolderDto) {
    await this.getOwnedFolder(ownerId, dataRoomId, folderId);
    try {
      return await this.prisma.folder.update({
        where: { id: folderId },
        data: { name: dto.name },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A folder with this name already exists here');
      }
      throw error;
    }
  }

  async remove(ownerId: string, dataRoomId: string, folderId: string) {
    await this.getOwnedFolder(ownerId, dataRoomId, folderId);
    await this.prisma.folder.delete({ where: { id: folderId } });
  }

  // Ancestor chain root -> folder, for breadcrumb rendering. Walking the
  // adjacency list one hop at a time is fine here: breadcrumb depth is
  // small and bounded, unlike the subtree below.
  async getPath(userId: string, dataRoomId: string, folderId: string) {
    await this.getAccessibleFolder(userId, dataRoomId, folderId);

    const path: { id: string; name: string }[] = [];
    let currentId: string | null = folderId;

    while (currentId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: currentId, dataRoomId },
        select: { id: true, name: true, parentId: true },
      });
      if (!folder) {
        throw new NotFoundException('Folder not found');
      }
      path.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parentId;
    }

    return path;
  }

  // Powers the delete-confirmation warning. A single recursive CTE instead
  // of N adjacency-list round trips because a subtree can be arbitrarily
  // deep and wide — see README "how it scales" for the trade-off.
  async getSubtreeSummary(ownerId: string, dataRoomId: string, folderId: string) {
    await this.getOwnedFolder(ownerId, dataRoomId, folderId);

    const rows = await this.prisma.$queryRaw<SubtreeSummaryRow[]>`
      WITH RECURSIVE subtree AS (
        SELECT id FROM folders WHERE id = ${folderId}
        UNION ALL
        SELECT f.id FROM folders f INNER JOIN subtree s ON f."parentId" = s.id
      )
      SELECT
        (SELECT COUNT(*)::int FROM subtree) - 1 AS "subfolderCount",
        (SELECT COUNT(*)::int FROM files WHERE "folderId" IN (SELECT id FROM subtree)) AS "fileCount",
        (SELECT COALESCE(SUM(v."sizeBytes"), 0)::bigint
           FROM files f
           JOIN file_versions v ON v.id = f."currentVersionId"
          WHERE f."folderId" IN (SELECT id FROM subtree)) AS "totalSizeBytes",
        (SELECT COUNT(*)::int FROM shares WHERE "revokedAt" IS NULL AND (
          ("resourceType" = 'FOLDER' AND "resourceId" IN (SELECT id FROM subtree))
          OR ("resourceType" = 'FILE' AND "resourceId" IN (SELECT id FROM files WHERE "folderId" IN (SELECT id FROM subtree)))
        )) AS "activeShareCount"
    `;

    const row = rows[0];
    return {
      subfolderCount: row.subfolderCount,
      fileCount: row.fileCount,
      activeShareCount: row.activeShareCount,
      totalSizeBytes: row.totalSizeBytes.toString(),
    };
  }
}
