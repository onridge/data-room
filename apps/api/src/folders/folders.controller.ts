import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('data-rooms/:dataRoomId/folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param('dataRoomId') dataRoomId: string,
    @Body() dto: CreateFolderDto,
  ) {
    return this.foldersService.create(user.userId, dataRoomId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser, @Param('dataRoomId') dataRoomId: string) {
    return this.foldersService.findAll(user.userId, dataRoomId);
  }

  @Get(':folderId')
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('dataRoomId') dataRoomId: string,
    @Param('folderId') folderId: string,
  ) {
    return this.foldersService.findOne(user.userId, dataRoomId, folderId);
  }

  @Get(':folderId/path')
  getPath(
    @CurrentUser() user: RequestUser,
    @Param('dataRoomId') dataRoomId: string,
    @Param('folderId') folderId: string,
  ) {
    return this.foldersService.getPath(user.userId, dataRoomId, folderId);
  }

  @Get(':folderId/summary')
  getSubtreeSummary(
    @CurrentUser() user: RequestUser,
    @Param('dataRoomId') dataRoomId: string,
    @Param('folderId') folderId: string,
  ) {
    return this.foldersService.getSubtreeSummary(user.userId, dataRoomId, folderId);
  }

  @Patch(':folderId')
  rename(
    @CurrentUser() user: RequestUser,
    @Param('dataRoomId') dataRoomId: string,
    @Param('folderId') folderId: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.foldersService.rename(user.userId, dataRoomId, folderId, dto);
  }

  @Delete(':folderId')
  remove(
    @CurrentUser() user: RequestUser,
    @Param('dataRoomId') dataRoomId: string,
    @Param('folderId') folderId: string,
  ) {
    return this.foldersService.remove(user.userId, dataRoomId, folderId);
  }
}
