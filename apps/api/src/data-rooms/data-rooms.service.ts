import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDataRoomDto } from './dto/create-data-room.dto';
import { UpdateDataRoomDto } from './dto/update-data-room.dto';

@Injectable()
export class DataRoomsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async rename(ownerId: string, id: string, dto: UpdateDataRoomDto) {
    await this.findOneOwned(ownerId, id);
    return this.prisma.dataRoom.update({ where: { id }, data: { name: dto.name } });
  }

  async remove(ownerId: string, id: string) {
    await this.findOneOwned(ownerId, id);
    await this.prisma.dataRoom.delete({ where: { id } });
  }
}
