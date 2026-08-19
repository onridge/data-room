import { Module } from '@nestjs/common';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';
import { SharesModule } from '../shares/shares.module';

@Module({
  imports: [SharesModule],
  controllers: [FoldersController],
  providers: [FoldersService],
})
export class FoldersModule {}
