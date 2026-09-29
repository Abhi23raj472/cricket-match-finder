import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsISO8601, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import type { AdminRightInput } from '@cmf/shared';

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class CreateRightDto implements AdminRightInput {
  @IsUUID('4', { message: 'broadcasterId must be a UUID' })
  broadcasterId!: string;

  @IsUUID('4', { message: 'tournamentId must be a UUID' })
  tournamentId!: string;

  /** null or missing = the whole tournament */
  @IsOptional()
  @IsUUID('4', { message: 'matchId must be a UUID' })
  matchId?: string | null;

  @Transform(upper)
  @Matches(/^[A-Z]{2}$/, { message: 'regionCode must be a 2-letter country code, e.g. IN' })
  regionCode!: string;

  @Matches(/^[a-z]{2,3}(-[A-Z]{2})?$/, { message: 'language must be a language code, e.g. en, hi, ta' })
  language!: string;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'validFrom must be an ISO date, e.g. 2026-10-01' })
  validFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'validTo must be an ISO date, e.g. 2026-10-31' })
  validTo?: string;
}

export class UpdateRightDto extends PartialType(CreateRightDto) {}

export class ListRightsQuery {
  @IsOptional()
  @IsUUID('4')
  tournament?: string;

  @IsOptional()
  @IsUUID('4')
  broadcaster?: string;

  @IsOptional()
  @Transform(upper)
  @Matches(/^[A-Z]{2}$/, { message: 'region must be a 2-letter country code' })
  region?: string;
}

export class RightsGapsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  days: number = 14;

  @IsOptional()
  @Transform(upper)
  @Matches(/^[A-Z]{2}$/, { message: 'region must be a 2-letter country code' })
  region?: string;
}
