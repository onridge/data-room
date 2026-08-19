import { IsEnum, IsString } from 'class-validator';
import { ShareResourceType } from '@prisma/client';

export class ListSharesQueryDto {
  @IsEnum(ShareResourceType)
  resourceType: ShareResourceType;

  @IsString()
  resourceId: string;
}
