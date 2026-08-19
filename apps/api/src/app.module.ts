import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DataRoomsModule } from './data-rooms/data-rooms.module';
import { FoldersModule } from './folders/folders.module';

@Module({
  imports: [PrismaModule, AuthModule, DataRoomsModule, FoldersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
