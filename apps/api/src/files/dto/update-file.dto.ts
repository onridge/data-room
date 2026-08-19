import { IsString, MinLength } from 'class-validator';

export class UpdateFileDto {
  @IsString()
  @MinLength(1)
  name: string;
}
