import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { LiveScoreDto, MatchDetailDto, MatchSummaryDto, Paginated } from '@cmf/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LIVE_BUS, type LiveBus } from '../live/live-bus';
import { zonedDayRange } from '../common/timezone';
import type { Viewer } from '../common/viewer';
import type { ListMatchesQuery } from './dto/list-matches.query';
import { matchInclude, toLiveScoreDto, toMatchSummary, type MatchRow } from './match.mapper';
import { buildWatchOptions, type RightRow } from './watch-options';

/** Builds the Prisma where/orderBy for GET /matches. Exported for tests. */
export function buildMatchListQuery(q: ListMatchesQuery, timezone: string) {
  const where: Prisma.MatchWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.tournament) where.tournamentId = q.tournament;
  if (q.team) where.OR = [{ homeTeamId: q.team }, { awayTeamId: q.team }];
  if (q.date) {
    const { start, end } = zonedDayRange(q.date, timezone);
    where.startTimeUtc = { gte: start, lt: end };
  }
  // Results: newest first. Everything else: soonest first.
  const orderBy: Prisma.MatchOrderByWithRelationInput[] =
    q.status === 'completed' || q.status === 'abandoned'
      ? [{ startTimeUtc: 'desc' }, { id: 'asc' }]
      : [{ startTimeUtc: 'asc' }, { id: 'asc' }];
  return { where, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(LIVE_BUS) private readonly bus: LiveBus,
  ) {}

  async list(q: ListMatchesQuery, viewer: Viewer): Promise<Paginated<MatchSummaryDto>> {
    const { where, orderBy, skip, take } = buildMatchListQuery(q, viewer.timezone);
    const [rows, total] = await Promise.all([
      this.prisma.match.findMany({ where, orderBy, skip, take, include: matchInclude }),
      this.prisma.match.count({ where }),
    ]);
    return {
      items: (rows as unknown as MatchRow[]).map(toMatchSummary),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async detail(id: string, viewer: Viewer): Promise<MatchDetailDto> {
    const row = (await this.prisma.match.findUnique({ where: { id }, include: matchInclude })) as unknown as MatchRow | null;
    if (!row) throw new NotFoundException(`Match ${id} not found`);

    // Rights valid at the match's start time, for the viewer's region.
    const rights = (await this.prisma.broadcastRight.findMany({
      where: {
        tournamentId: row.tournamentId,
        regionCode: viewer.region,
        OR: [{ matchId: null }, { matchId: row.id }],
        validFrom: { lte: row.startTimeUtc },
        validTo: { gte: row.startTimeUtc },
      },
      include: { broadcaster: true },
    })) as unknown as RightRow[];

    return {
      ...toMatchSummary(row),
      watchOptions: buildWatchOptions(rights, row, viewer.subscribedBroadcasterIds),
      live: await this.latestScore(row),
    };
  }

  /** Newest scorecard: the live cache first (freshest), else the database. */
  async latestScore(row: Pick<MatchRow, 'id' | 'status' | 'tossText' | 'liveScore'>): Promise<LiveScoreDto | null> {
    const cached = await this.bus.getCached(row.id).catch(() => null);
    if (cached) return cached;
    return row.liveScore ? toLiveScoreDto(row.liveScore, row) : null;
  }

  /** For the SSE endpoint: 404s for unknown matches, else the current snapshot. */
  async snapshotForStream(id: string): Promise<{ status: MatchRow['status']; score: LiveScoreDto | null }> {
    const row = (await this.prisma.match.findUnique({
      where: { id },
      select: { id: true, status: true, tossText: true, liveScore: true },
    })) as Pick<MatchRow, 'id' | 'status' | 'tossText' | 'liveScore'> | null;
    if (!row) throw new NotFoundException(`Match ${id} not found`);
    return { status: row.status, score: await this.latestScore(row) };
  }
}
