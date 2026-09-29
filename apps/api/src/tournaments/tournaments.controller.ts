import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import type { TournamentDetailDto, TournamentListItemDto } from '@cmf/shared';
import { TournamentsService } from './tournaments.service';

export class ListTournamentsQuery {
  /** true = include finished tournaments too */
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean({ message: 'all must be true or false' })
  all?: boolean;
}

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Get()
  list(@Query() q: ListTournamentsQuery): Promise<TournamentListItemDto[]> {
    return this.tournaments.list(q.all ?? false);
  }

  /** Tournament with its points table. Fixtures/results: GET /matches?tournament=:id */
  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string): Promise<TournamentDetailDto> {
    return this.tournaments.detail(id);
  }
}
