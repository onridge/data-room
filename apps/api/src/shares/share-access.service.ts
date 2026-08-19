import { Injectable, NotFoundException } from '@nestjs/common';
import { ShareMode, ShareResourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface ChainNode {
  resourceType: ShareResourceType;
  resourceId: string;
}

@Injectable()
export class ShareAccessService {
  constructor(private readonly prisma: PrismaService) {}

  // True if userId owns the resource outright, or an active permissioned
  // share grants them read access anywhere from the resource up to its data
  // room — a share on a Data Room or Folder cascades to everything nested
  // inside it, per the sharing spec.
  async canRead(userId: string, resourceType: ShareResourceType, resourceId: string) {
    const chain = await this.buildChain(resourceType, resourceId);
    if (!chain) return false;
    if (chain.ownerId === userId) return true;

    const grant = await this.prisma.shareGrant.findFirst({
      where: {
        userId,
        share: {
          revokedAt: null,
          OR: chain.nodes.map((node) => ({
            resourceType: node.resourceType,
            resourceId: node.resourceId,
          })),
        },
      },
    });
    return !!grant;
  }

  // Resolves an unauthenticated public-link token to its active Share —
  // used by the /public routes, which carry no user at all.
  async resolvePublicShare(token: string) {
    const share = await this.prisma.share.findFirst({
      where: { token, mode: ShareMode.PUBLIC, revokedAt: null },
    });
    if (!share) {
      throw new NotFoundException('Link not found or revoked');
    }
    return share;
  }

  // True if resourceType/resourceId is the share's own resource or nested
  // inside it — bounds a public link to exactly the subtree the owner
  // shared, not the rest of the data room.
  async isWithinShare(
    share: { resourceType: ShareResourceType; resourceId: string },
    resourceType: ShareResourceType,
    resourceId: string,
  ) {
    const chain = await this.buildChain(resourceType, resourceId);
    if (!chain) return false;
    return chain.nodes.some(
      (node) => node.resourceType === share.resourceType && node.resourceId === share.resourceId,
    );
  }

  async resolveResourceName(resourceType: ShareResourceType, resourceId: string) {
    if (resourceType === ShareResourceType.DATA_ROOM) {
      return (await this.prisma.dataRoom.findUnique({ where: { id: resourceId } }))?.name;
    }
    if (resourceType === ShareResourceType.FOLDER) {
      return (await this.prisma.folder.findUnique({ where: { id: resourceId } }))?.name;
    }
    return (await this.prisma.file.findUnique({ where: { id: resourceId } }))?.name;
  }

  async resolveDataRoomId(resourceType: ShareResourceType, resourceId: string) {
    if (resourceType === ShareResourceType.DATA_ROOM) return resourceId;
    if (resourceType === ShareResourceType.FOLDER) {
      return (await this.prisma.folder.findUnique({ where: { id: resourceId } }))?.dataRoomId;
    }
    return (await this.prisma.file.findUnique({ where: { id: resourceId } }))?.dataRoomId;
  }

  private async buildChain(resourceType: ShareResourceType, resourceId: string) {
    if (resourceType === ShareResourceType.DATA_ROOM) {
      const room = await this.prisma.dataRoom.findUnique({ where: { id: resourceId } });
      if (!room) return null;
      return {
        ownerId: room.ownerId,
        nodes: [{ resourceType: ShareResourceType.DATA_ROOM, resourceId: room.id }] as ChainNode[],
      };
    }

    if (resourceType === ShareResourceType.FOLDER) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: resourceId },
        include: { dataRoom: true },
      });
      if (!folder) return null;
      const ancestorIds = await this.ancestorFolderIds(folder.parentId);
      const nodes: ChainNode[] = [
        { resourceType: ShareResourceType.FOLDER, resourceId: folder.id },
        ...ancestorIds.map((id) => ({ resourceType: ShareResourceType.FOLDER, resourceId: id }) as ChainNode),
        { resourceType: ShareResourceType.DATA_ROOM, resourceId: folder.dataRoomId },
      ];
      return { ownerId: folder.dataRoom.ownerId, nodes };
    }

    const file = await this.prisma.file.findUnique({
      where: { id: resourceId },
      include: { dataRoom: true },
    });
    if (!file) return null;
    const ancestorIds = await this.ancestorFolderIds(file.folderId);
    const nodes: ChainNode[] = [
      { resourceType: ShareResourceType.FILE, resourceId: file.id },
      ...ancestorIds.map((id) => ({ resourceType: ShareResourceType.FOLDER, resourceId: id }) as ChainNode),
      { resourceType: ShareResourceType.DATA_ROOM, resourceId: file.dataRoomId },
    ];
    return { ownerId: file.dataRoom.ownerId, nodes };
  }

  // Walks parentId one hop at a time — same bounded-depth trade-off as the
  // breadcrumb path lookup in FoldersService, not worth a recursive CTE.
  private async ancestorFolderIds(startParentId: string | null) {
    const ids: string[] = [];
    let currentId = startParentId;
    while (currentId) {
      ids.push(currentId);
      const parent = await this.prisma.folder.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      currentId = parent?.parentId ?? null;
    }
    return ids;
  }
}
