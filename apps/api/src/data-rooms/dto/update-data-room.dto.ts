import { IsString, MinLength } from 'class-validator';

export class UpdateDataRoomDto {
  @IsString()
  @MinLength(1)
  name: string;
}
