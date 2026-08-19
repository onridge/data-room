import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { DataRoomsService } from './data-rooms.service';
import { CreateDataRoomDto } from './dto/create-data-room.dto';
import { UpdateDataRoomDto } from './dto/update-data-room.dto';
import { ListContentsQueryDto } from './dto/list-contents-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('data-rooms')
export class DataRoomsController {
  constructor(private readonly dataRoomsService: DataRoomsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateDataRoomDto) {
    return this.dataRoomsService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.dataRoomsService.findAllForOwner(user.userId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.dataRoomsService.findOneAccessible(user.userId, id);
  }

  @Get(':id/contents')
  getContents(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query() query: ListContentsQueryDto,
  ) {
    return this.dataRoomsService.getContents(user.userId, id, query.folderId);
  }

  @Get(':id/summary')
  getSummary(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.dataRoomsService.getSummary(user.userId, id);
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateDataRoomDto,
  ) {
    return this.dataRoomsService.rename(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.dataRoomsService.remove(user.userId, id);
  }
}
