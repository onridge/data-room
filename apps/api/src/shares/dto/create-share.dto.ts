import { IsArray, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { ShareMode, ShareResourceType } from '@prisma/client';

export class CreateShareDto {
  @IsEnum(ShareResourceType)
  resourceType: ShareResourceType;

  @IsString()
  resourceId: string;

  @IsEnum(ShareMode)
  mode: ShareMode;

  // Only used when mode = PERMISSIONED — each email gets a grant on the share.
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emails?: string[];
}
