import { Module } from '@nestjs/common';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';
import { ShareAccessService } from './share-access.service';

@Module({
  controllers: [SharesController],
  providers: [SharesService, ShareAccessService],
  exports: [ShareAccessService],
})
export class SharesModule {}
