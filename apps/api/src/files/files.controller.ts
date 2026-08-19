import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import type { HandleUploadBody } from '@vercel/blob/client';
import { FilesService } from './files.service';
import { UpdateFileDto } from './dto/update-file.dto';
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
  @Delete(':fileId')
  remove(
    @CurrentUser() user: RequestUser,
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.filesService.remove(user.userId, dataRoomId, fileId);
  }
}
