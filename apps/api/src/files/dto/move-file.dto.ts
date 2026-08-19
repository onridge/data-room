import { IsOptional, IsString } from 'class-validator';

export class MoveFileDto {
  // Omitted/undefined = move to the data room root, same convention as
  // upload's folderId query param.
  @IsOptional()
  @IsString()
  folderId?: string;
}
