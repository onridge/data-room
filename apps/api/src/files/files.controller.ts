import { Body, Controller, Param, Post, Query, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Request } from 'express';
import type { HandleUploadBody } from '@vercel/blob/client';
import { FilesService } from './files.service';

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
}
