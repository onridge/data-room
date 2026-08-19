import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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

  // Granting access resolves emails against real accounts and says so when
  // one is missing, which the owner genuinely needs to know — but it also
  // makes this the one endpoint that can be used to probe whether an email
  // is registered. Rate limiting is what keeps that from being a usable
  // enumeration oracle; the message itself stays useful.
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
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

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
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
