import { IsString, MinLength } from 'class-validator';

export class CreateDataRoomDto {
  @IsString()
  @MinLength(1)
  name: string;
}
