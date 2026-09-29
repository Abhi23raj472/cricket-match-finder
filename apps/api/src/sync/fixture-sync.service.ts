import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { MatchStatus } from '@cmf/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  CRICKET_PROVIDER,
  type CricketDataProvider,
  type ProviderSeries,
  type ProviderTeam,
  type ProviderVenue,
} from '../provider/cricket-provider.interface';

const DAY = 24 * 60 * 60 * 1000;

export interface SyncResult {
  fixtures: number;
  teams: number;
  venues: number;
  tournaments: number;
  matchesCreated: number;
  matchesUpdated: number;
}

/** Higher = further along. A sync never moves a match backwards. */
const STATUS_RANK: Record<MatchStatus, number> = { upcoming: 0, live: 1, completed: 2, abandoned: 2 };

export function nextStatus(current: MatchStatus | undefined, incoming: MatchStatus): MatchStatus {
  if (!current) return incoming;
  return STATUS_RANK[incoming] >= STATUS_RANK[current] ? incoming : current;
}

/**
 * Every 6 hours (and once on startup) pulls fixtures from 7 days ago to
 * 30 days ahead and upserts teams, venues, tournaments and matches by
 * provider id. Scores are left to the live poller.
 */
@Injectable()
export class FixtureSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FixtureSyncService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CRICKET_PROVIDER) private readonly provider: CricketDataProvider,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('JOBS_ENABLED', 'true') === 'false') return;
    if (this.config.get('SYNC_ON_BOOT', 'true') === 'false') return;
    void this.sync().catch((err) => this.logger.error(`Startup fixture sync failed: ${err.message}`));
  }

  @Cron(CronExpression.EVERY_6_HOURS, { name: 'fixture-sync' })
  async scheduledSync() {
    if (this.config.get('JOBS_ENABLED', 'true') === 'false') return;
    try {
      await this.sync();
    } catch (err) {
      this.logger.error(`Scheduled fixture sync failed: ${(err as Error).message}`);
    }
  }

  async sync(now: Date = new Date()): Promise<SyncResult | null> {
    if (this.running) {
      this.logger.warn('Fixture sync already running; skipped');
      return null;
    }
    this.running = true;
    try {
      const fixtures = await this.provider.listFixtures(new Date(now.getTime() - 7 * DAY), new Date(now.getTime() + 30 * DAY));

      // Dedupe the entities referenced by the fixtures.
      const teams = new Map<string, ProviderTeam>();
      const venues = new Map<string, ProviderVenue>();
      const series = new Map<string, ProviderSeries>();
      for (const f of fixtures) {
        teams.set(f.homeTeam.providerTeamId, f.homeTeam);
        teams.set(f.awayTeam.providerTeamId, f.awayTeam);
        venues.set(f.venue.providerVenueId, f.venue);
        series.set(f.series.providerSeriesId, f.series);
      }

      const teamIds = new Map<string, string>();
      for (const t of teams.values()) {
        const data = { name: t.name, shortCode: t.shortCode, country: t.country ?? null, logoUrl: t.logoUrl ?? null };
        const row = await this.prisma.team.upsert({
          where: { providerTeamId: t.providerTeamId },
          create: { ...data, providerTeamId: t.providerTeamId },
          update: data,
          select: { id: true },
        });
        teamIds.set(t.providerTeamId, row.id);
      }

      const venueIds = new Map<string, string>();
      for (const v of venues.values()) {
        const data = { name: v.name, city: v.city, country: v.country, timezone: v.timezone };
        const row = await this.prisma.venue.upsert({
          where: { providerVenueId: v.providerVenueId },
          create: { ...data, providerVenueId: v.providerVenueId },
          update: data,
          select: { id: true },
        });
        venueIds.set(v.providerVenueId, row.id);
      }

      const tournamentIds = new Map<string, string>();
      for (const s of series.values()) {
        const data = {
          name: s.name,
          format: s.format,
          season: s.season,
          startDate: new Date(s.startDate),
          endDate: new Date(s.endDate),
        };
        const row = await this.prisma.tournament.upsert({
          where: { providerSeriesId: s.providerSeriesId },
          create: { ...data, providerSeriesId: s.providerSeriesId },
          update: data,
          select: { id: true },
        });
        tournamentIds.set(s.providerSeriesId, row.id);
      }

      const existing = await this.prisma.match.findMany({
        where: { providerMatchId: { in: fixtures.map((f) => f.providerMatchId) } },
        select: { providerMatchId: true, status: true },
      });
      const existingStatus = new Map(existing.map((e) => [e.providerMatchId, e.status as MatchStatus]));

      let matchesCreated = 0;
      let matchesUpdated = 0;
      for (const f of fixtures) {
        const current = existingStatus.get(f.providerMatchId);
        const data = {
          tournamentId: tournamentIds.get(f.series.providerSeriesId)!,
          homeTeamId: teamIds.get(f.homeTeam.providerTeamId)!,
          awayTeamId: teamIds.get(f.awayTeam.providerTeamId)!,
          venueId: venueIds.get(f.venue.providerVenueId)!,
          matchNo: f.matchNo ?? null,
          startTimeUtc: new Date(f.startTimeUtc),
          status: nextStatus(current, f.status),
          tossText: f.tossText ?? null,
          resultText: f.resultText ?? null,
        };
        await this.prisma.match.upsert({
          where: { providerMatchId: f.providerMatchId },
          create: { ...data, providerMatchId: f.providerMatchId },
          update: data,
        });
        if (current) matchesUpdated++;
        else matchesCreated++;
      }

      const result: SyncResult = {
        fixtures: fixtures.length,
        teams: teams.size,
        venues: venues.size,
        tournaments: series.size,
        matchesCreated,
        matchesUpdated,
      };
      this.logger.log(`Fixture sync (${this.provider.name}): ${JSON.stringify(result)}`);
      return result;
    } finally {
      this.running = false;
    }
  }
}
