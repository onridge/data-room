import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PublicService } from './public.service';

// No JwtAuthGuard anywhere in this controller — the token in the URL is
// the entire authorization for a public link, by design.
@Controller('public/:token')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get()
  getShareInfo(@Param('token') token: string) {
    return this.publicService.getShareInfo(token);
  }

  @Get('contents')
  getContents(@Param('token') token: string, @Query('folderId') folderId?: string) {
    return this.publicService.getContents(token, folderId);
  }

  @Get('files/:fileId/content')
  streamFileContent(
    @Param('token') token: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    return this.publicService.streamFileContent(token, fileId, res);
  }
}
