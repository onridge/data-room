import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SharesService } from './shares.service';
import { CreateShareDto } from './dto/create-share.dto';
import { AddGrantDto } from './dto/add-grant.dto';
import { ListSharesQueryDto } from './dto/list-shares-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateShareDto) {
    return this.sharesService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser, @Query() query: ListSharesQueryDto) {
    return this.sharesService.findAllForResource(user.userId, query.resourceType, query.resourceId);
  }

  @Delete(':shareId')
  revoke(@CurrentUser() user: RequestUser, @Param('shareId') shareId: string) {
    return this.sharesService.revoke(user.userId, shareId);
  }

  @Post(':shareId/grants')
  addGrant(
    @CurrentUser() user: RequestUser,
    @Param('shareId') shareId: string,
    @Body() dto: AddGrantDto,
  ) {
    return this.sharesService.addGrant(user.userId, shareId, dto);
  }

  @Delete(':shareId/grants/:grantId')
  removeGrant(
    @CurrentUser() user: RequestUser,
    @Param('shareId') shareId: string,
    @Param('grantId') grantId: string,
  ) {
    return this.sharesService.removeGrant(user.userId, shareId, grantId);
  }
}
