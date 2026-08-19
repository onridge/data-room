import { Module } from '@nestjs/common';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';
import { ShareAccessService } from './share-access.service';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  controllers: [SharesController, PublicController],
  providers: [SharesService, ShareAccessService, PublicService],
  exports: [ShareAccessService],
})
export class SharesModule {}
