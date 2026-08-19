import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DataRoomsModule } from './data-rooms/data-rooms.module';
import { FoldersModule } from './folders/folders.module';
import { FilesModule } from './files/files.module';
import { SharesModule } from './shares/shares.module';

@Module({
  imports: [PrismaModule, AuthModule, DataRoomsModule, FoldersModule, FilesModule, SharesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
