import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { getJwtSecret } from '../auth/jwt-secret.util';

@Module({
  imports: [
    JwtModule.register({
      secret: getJwtSecret(),
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
