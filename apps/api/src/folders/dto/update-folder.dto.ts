import { IsString, MinLength } from 'class-validator';

export class UpdateFolderDto {
  @IsString()
  @MinLength(1)
  name: string;
}
