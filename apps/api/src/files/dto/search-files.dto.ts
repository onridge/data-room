import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SearchFilesDto {
  // Trimmed before validation so a query of only spaces is rejected rather
  // than turning into a `contains ' '` scan that matches half the room.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q: string;
}
