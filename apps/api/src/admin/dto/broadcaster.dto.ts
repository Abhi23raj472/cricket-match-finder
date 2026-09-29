import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, Length } from 'class-validator';
import type { AdminBroadcasterInput, BroadcasterType } from '@cmf/shared';
import { IsLinkTemplate } from '../link-templates';

const TYPES: BroadcasterType[] = ['OTT', 'TV', 'FREE'];
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? null : typeof value === 'string' ? value.trim() : value);

export class CreateBroadcasterDto implements AdminBroadcasterInput {
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  name!: string;

  @IsIn(TYPES, { message: `type must be one of: ${TYPES.join(', ')}` })
  type!: BroadcasterType;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'logoUrl must be an https:// URL' })
  logoUrl?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsLinkTemplate('app')
  appDeeplinkTemplate?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsLinkTemplate('web')
  webUrlTemplate?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'affiliateUrl must be an https:// URL' })
  affiliateUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBroadcasterDto extends PartialType(CreateBroadcasterDto) {}
