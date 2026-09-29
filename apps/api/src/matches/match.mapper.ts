import type {
  InningsDto,
  LiveScoreDto,
  MatchFormat,
  MatchStatus,
  MatchSummaryDto,
  ShortScore,
  TeamDto,
} from '@cmf/shared';

/** Prisma row shape used by the list and detail queries (see matchInclude). */
export interface MatchRow {
  id: string;
  providerMatchId: string;
  matchNo: string | null;
  startTimeUtc: Date;
  status: MatchStatus;
  tossText: string | null;
  resultText: string | null;
  tournamentId: string;
  tournament: { id: string; name: string; format: MatchFormat };
  homeTeam: TeamRow;
  awayTeam: TeamRow;
  venue: { name: string; city: string };
  liveScore: LiveScoreRow | null;
}

export interface TeamRow {
  id: string;
  name: string;
  shortCode: string;
  country: string | null;
  logoUrl: string | null;
}

export interface LiveScoreRow {
  matchId: string;
  innings: unknown;
  currentBatters: unknown;
  currentBowler: unknown;
  lastSixBalls: string[];
  commentary: unknown;
  updatedAt: Date;
}

/** Prisma `include` that produces a MatchRow. */
export const matchInclude = {
  tournament: { select: { id: true, name: true, format: true } },
  homeTeam: { select: { id: true, name: true, shortCode: true, country: true, logoUrl: true } },
  awayTeam: { select: { id: true, name: true, shortCode: true, country: true, logoUrl: true } },
  venue: { select: { name: true, city: true } },
  liveScore: true,
} as const;

export const toTeamDto = (t: TeamRow): TeamDto => ({
  id: t.id,
  name: t.name,
  shortCode: t.shortCode,
  country: t.country,
  logoUrl: t.logoUrl,
});

export function shortScores(innings: InningsDto[]): ShortScore[] {
  return innings.map((i) => ({ teamId: i.battingTeamId, runs: i.runs, wickets: i.wickets, overs: i.overs }));
}

export function toMatchSummary(m: MatchRow): MatchSummaryDto {
  const innings = (m.liveScore?.innings as InningsDto[] | undefined) ?? [];
  return {
    id: m.id,
    tournament: { id: m.tournament.id, name: m.tournament.name, format: m.tournament.format },
    homeTeam: toTeamDto(m.homeTeam),
    awayTeam: toTeamDto(m.awayTeam),
    venue: { name: m.venue.name, city: m.venue.city },
    matchNo: m.matchNo,
    startTimeUtc: m.startTimeUtc.toISOString(),
    status: m.status,
    resultText: m.resultText,
    scores: shortScores(innings),
  };
}

export function toLiveScoreDto(row: LiveScoreRow, match: { status: MatchStatus; tossText: string | null }): LiveScoreDto {
  return {
    matchId: row.matchId,
    status: match.status,
    tossText: match.tossText,
    innings: (row.innings as InningsDto[]) ?? [],
    currentBatters: (row.currentBatters as LiveScoreDto['currentBatters']) ?? [],
    currentBowler: (row.currentBowler as LiveScoreDto['currentBowler']) ?? null,
    lastSixBalls: row.lastSixBalls ?? [],
    commentary: (row.commentary as LiveScoreDto['commentary']) ?? [],
    updatedAt: row.updatedAt.toISOString(),
  };
}
