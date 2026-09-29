import { Injectable, NotFoundException } from '@nestjs/common';
import type { InningsDto, MatchFormat, MatchStatus, TournamentDetailDto, TournamentDto, TournamentListItemDto } from '@cmf/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toTeamDto, type TeamRow } from '../matches/match.mapper';
import { computeStandings } from './standings';

interface TournamentRow {
  id: string;
  name: string;
  format: MatchFormat;
  season: string;
  startDate: Date;
  endDate: Date;
}

const toTournamentDto = (t: TournamentRow): TournamentDto => ({
  id: t.id,
  name: t.name,
  format: t.format,
  season: t.season,
  startDate: t.startDate.toISOString().slice(0, 10),
  endDate: t.endDate.toISOString().slice(0, 10),
});

const teamSelect = { id: true, name: true, shortCode: true, country: true, logoUrl: true } as const;

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current and upcoming tournaments (or all, with ?all=true), soonest first. */
  async list(all: boolean, now = new Date()): Promise<TournamentListItemDto[]> {
    const today = new Date(now.toISOString().slice(0, 10));
    const rows = (await this.prisma.tournament.findMany({
      where: all ? {} : { endDate: { gte: today } },
      orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
      include: { matches: { select: { status: true } } },
    })) as unknown as (TournamentRow & { matches: { status: MatchStatus }[] })[];

    return rows.map((t) => ({
      ...toTournamentDto(t),
      matchCount: t.matches.length,
      liveCount: t.matches.filter((m) => m.status === 'live').length,
    }));
  }

  async detail(id: string): Promise<TournamentDetailDto> {
    const t = (await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        matches: {
          select: {
            status: true,
            homeTeamId: true,
            awayTeamId: true,
            homeTeam: { select: teamSelect },
            awayTeam: { select: teamSelect },
            liveScore: { select: { innings: true } },
          },
        },
      },
    })) as unknown as
      | (TournamentRow & {
          matches: {
            status: MatchStatus;
            homeTeamId: string;
            awayTeamId: string;
            homeTeam: TeamRow;
            awayTeam: TeamRow;
            liveScore: { innings: unknown } | null;
          }[];
        })
      | null;
    if (!t) throw new NotFoundException(`Tournament ${id} not found`);

    const teams = new Map<string, TeamRow>();
    for (const m of t.matches) {
      teams.set(m.homeTeam.id, m.homeTeam);
      teams.set(m.awayTeam.id, m.awayTeam);
    }

    const standings = computeStandings(
      [...teams.values()].map(toTeamDto),
      t.matches.map((m) => ({
        status: m.status,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        innings: (m.liveScore?.innings as InningsDto[] | undefined) ?? [],
      })),
      t.format,
    );

    return { ...toTournamentDto(t), standings };
  }
}
