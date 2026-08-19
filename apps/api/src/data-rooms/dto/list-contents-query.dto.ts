import { IsOptional, IsUUID } from 'class-validator';

export class ListContentsQueryDto {
  @IsOptional()
  @IsUUID()
  folderId?: string;
}
