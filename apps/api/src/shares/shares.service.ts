import { randomUUID } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ShareMode, ShareResourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShareDto } from './dto/create-share.dto';
import { AddGrantDto } from './dto/add-grant.dto';

@Injectable()
export class SharesService {
  constructor(private readonly prisma: PrismaService) {}

  // Every resourceType resolves back to a DataRoom one way or another —
  // that's what ownership is actually checked against, since sharing is an
  // owner-only action.
  private async assertOwnedResource(
    ownerId: string,
    resourceType: ShareResourceType,
    resourceId: string,
  ) {
    if (resourceType === ShareResourceType.DATA_ROOM) {
      const dataRoom = await this.prisma.dataRoom.findFirst({
        where: { id: resourceId, ownerId },
      });
      if (!dataRoom) throw new NotFoundException('Data room not found');
      return;
    }
    if (resourceType === ShareResourceType.FOLDER) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: resourceId, dataRoom: { ownerId } },
      });
      if (!folder) throw new NotFoundException('Folder not found');
      return;
    }
    const file = await this.prisma.file.findFirst({
      where: { id: resourceId, dataRoom: { ownerId } },
    });
    if (!file) throw new NotFoundException('File not found');
  }

  private async getOwnedShare(ownerId: string, shareId: string) {
    const share = await this.prisma.share.findFirst({
      where: { id: shareId, createdById: ownerId },
    });
    if (!share) throw new NotFoundException('Share not found');
    return share;
  }

  private async resolveGrantUserIds(emails: string[]) {
    const users = await this.prisma.user.findMany({
      where: { email: { in: emails } },
    });
    const foundEmails = new Set(users.map((u) => u.email));
    const missing = emails.filter((email) => !foundEmails.has(email));
    if (missing.length > 0) {
      throw new NotFoundException(
        `No account found for: ${missing.join(', ')}. They need to register first.`,
      );
    }
    return users.map((u) => u.id);
  }

  // "Get or create" per (resourceType, resourceId, mode) rather than piling
  // up duplicate active shares every time the owner opens the share dialog.
  async create(ownerId: string, dto: CreateShareDto) {
    await this.assertOwnedResource(ownerId, dto.resourceType, dto.resourceId);

    const existing = await this.prisma.share.findFirst({
      where: {
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        mode: dto.mode,
        revokedAt: null,
      },
    });

    const share =
      existing ??
      (await this.prisma.share.create({
        data: {
          resourceType: dto.resourceType,
          resourceId: dto.resourceId,
          mode: dto.mode,
          token: dto.mode === ShareMode.PUBLIC ? randomUUID() : null,
          createdById: ownerId,
        },
      }));

    if (dto.mode === ShareMode.PERMISSIONED && dto.emails?.length) {
      const userIds = await this.resolveGrantUserIds(dto.emails);
      await this.prisma.shareGrant.createMany({
        data: userIds.map((userId) => ({ shareId: share.id, userId })),
        skipDuplicates: true,
      });
    }

    return this.prisma.share.findUniqueOrThrow({
      where: { id: share.id },
      include: { grants: { include: { user: { select: { id: true, email: true, name: true } } } } },
    });
  }

  async findAllForResource(ownerId: string, resourceType: ShareResourceType, resourceId: string) {
    await this.assertOwnedResource(ownerId, resourceType, resourceId);
    return this.prisma.share.findMany({
      where: { resourceType, resourceId, revokedAt: null },
      include: { grants: { include: { user: { select: { id: true, email: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(ownerId: string, shareId: string) {
    await this.getOwnedShare(ownerId, shareId);
    await this.prisma.share.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });
  }

  async addGrant(ownerId: string, shareId: string, dto: AddGrantDto) {
    const share = await this.getOwnedShare(ownerId, shareId);
    if (share.mode !== ShareMode.PERMISSIONED) {
      throw new ForbiddenException('Only permissioned shares can have grants');
    }
    const [userId] = await this.resolveGrantUserIds([dto.email]);
    return this.prisma.shareGrant.upsert({
      where: { shareId_userId: { shareId, userId } },
      create: { shareId, userId },
      update: {},
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async removeGrant(ownerId: string, shareId: string, grantId: string) {
    await this.getOwnedShare(ownerId, shareId);
    const grant = await this.prisma.shareGrant.findFirst({ where: { id: grantId, shareId } });
    if (!grant) throw new NotFoundException('Grant not found');
    await this.prisma.shareGrant.delete({ where: { id: grantId } });
  }
}
