import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PublicService } from './public.service';

// No JwtAuthGuard anywhere in this controller — the token in the URL is
// the entire authorization for a public link, by design. Since the token is
// the only thing standing between an anonymous caller and someone's
// documents, guessing at it is rate limited well below the global budget.
@Throttle({ default: { ttl: 60_000, limit: 30 } })
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
