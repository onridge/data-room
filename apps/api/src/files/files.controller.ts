import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { HandleUploadBody } from '@vercel/blob/client';
import { FilesService } from './files.service';
import { UpdateFileDto } from './dto/update-file.dto';
import { MoveFileDto } from './dto/move-file.dto';
import { SearchFilesDto } from './dto/search-files.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

@Controller('data-rooms/:dataRoomId/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // No JwtAuthGuard here on purpose — this single route also receives
  // Vercel's own "upload completed" callback, which carries no JWT.
  // Auth for the client-token step is checked by hand inside the service.
  // The bare ValidationPipe override stops the global whitelist pipe from
  // stripping Vercel's protocol payload down to nothing.
  @Post('upload')
  @UsePipes(new ValidationPipe({ transform: false, whitelist: false }))
  upload(
    @Req() request: Request,
    @Body() body: HandleUploadBody,
    @Param('dataRoomId') dataRoomId: string,
    @Query('folderId') folderId?: string,
  ) {
    return this.filesService.handleUploadRequest(request, body, dataRoomId, folderId);
  }

  // Declared before the ':fileId' routes so the literal segment is the one
  // that matches — Nest resolves in declaration order.
  @UseGuards(JwtAuthGuard)
  @Get('search')
  search(
    @CurrentUser() user: RequestUser,
    @Param('dataRoomId') dataRoomId: string,
    @Query() query: SearchFilesDto,
  ) {
    return this.filesService.search(user.userId, dataRoomId, query.q);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':fileId/versions')
  versions(
    @CurrentUser() user: RequestUser,
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.filesService.listVersions(user.userId, dataRoomId, fileId);
  }

  // ?version= opens a specific revision; without it the caller gets whatever
  // is current, which is what every listing and share link asks for.
  @UseGuards(JwtAuthGuard)
  @Get(':fileId/content')
  content(
    @CurrentUser() user: RequestUser,
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
    @Query('version') versionId?: string,
  ) {
    return this.filesService.streamContent(user.userId, dataRoomId, fileId, res, versionId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':fileId')
  rename(
    @CurrentUser() user: RequestUser,
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @Body() dto: UpdateFileDto,
  ) {
    return this.filesService.rename(user.userId, dataRoomId, fileId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':fileId/move')
  move(
    @CurrentUser() user: RequestUser,
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @Body() dto: MoveFileDto,
  ) {
    return this.filesService.move(user.userId, dataRoomId, fileId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':fileId')
  remove(
    @CurrentUser() user: RequestUser,
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.filesService.remove(user.userId, dataRoomId, fileId);
  }
}
