import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import type { MatchStatus } from '@cmf/shared';

export const MATCH_STATUSES: MatchStatus[] = ['upcoming', 'live', 'completed', 'abandoned'];

export class ListMatchesQuery {
  @IsOptional()
  @IsIn(MATCH_STATUSES, { message: `status must be one of: ${MATCH_STATUSES.join(', ')}` })
  status?: MatchStatus;

  @IsOptional()
  @IsUUID('4', { message: 'tournament must be a tournament id (UUID)' })
  tournament?: string;

  @IsOptional()
  @IsUUID('4', { message: 'team must be a team id (UUID)' })
  team?: string;

  /** Calendar day in the viewer's time zone (X-Timezone, default Asia/Kolkata). */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
