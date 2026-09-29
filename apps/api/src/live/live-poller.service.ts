import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CRICKET_PROVIDER, type CricketDataProvider } from '../provider/cricket-provider.interface';
import { LIVE_BUS, type LiveBus } from './live-bus';
import { mapLiveScore } from './live-score.mapper';

export interface PollResult {
  checked: number;
  updated: number;
  finished: number;
  failed: number;
}

/**
 * Every LIVE_POLL_MS (default 15 s) fetches scores for matches that are live,
 * or upcoming with a start time in the past (to catch the first ball), then
 * saves them, updates the match row and publishes to the live bus.
 */
@Injectable()
export class LivePollerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LivePollerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CRICKET_PROVIDER) private readonly provider: CricketDataProvider,
    @Inject(LIVE_BUS) private readonly bus: LiveBus,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('JOBS_ENABLED', 'true') === 'false') return;
    const everyMs = Number(this.config.get('LIVE_POLL_MS', 15000));
    const handle = setInterval(() => void this.poll(), everyMs);
    this.scheduler.addInterval('live-poller', handle);
    this.logger.log(`Live poller every ${everyMs} ms using provider "${this.provider.name}"`);
  }

  async poll(now: Date = new Date()): Promise<PollResult> {
    const result: PollResult = { checked: 0, updated: 0, finished: 0, failed: 0 };
    if (this.running) return result; // previous run still going
    this.running = true;
    try {
      const matches = await this.prisma.match.findMany({
        where: {
          OR: [{ status: 'live' }, { status: 'upcoming', startTimeUtc: { lte: now } }],
        },
        select: {
          id: true,
          providerMatchId: true,
          homeTeam: { select: { id: true, providerTeamId: true } },
          awayTeam: { select: { id: true, providerTeamId: true } },
        },
      });

      for (const m of matches) {
        result.checked++;
        try {
          const score = await this.provider.getLiveScore(m.providerMatchId);
          if (!score) continue;

          const { dto, match } = mapLiveScore(
            m.id,
            score,
            {
              [m.homeTeam.providerTeamId]: m.homeTeam.id,
              [m.awayTeam.providerTeamId]: m.awayTeam.id,
            },
            now,
          );

          const scoreData = {
            innings: dto.innings as unknown as Prisma.InputJsonValue,
            currentBatters: dto.currentBatters as unknown as Prisma.InputJsonValue,
            currentBowler: dto.currentBowler ? (dto.currentBowler as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            lastSixBalls: dto.lastSixBalls,
            commentary: dto.commentary as unknown as Prisma.InputJsonValue,
          };

          await this.prisma.$transaction([
            this.prisma.liveScore.upsert({
              where: { matchId: m.id },
              create: { matchId: m.id, ...scoreData },
              update: scoreData,
            }),
            this.prisma.match.update({ where: { id: m.id }, data: match }),
          ]);

          await this.bus.publish(dto);
          result.updated++;
          if (match.status === 'completed') {
            result.finished++;
            this.logger.log(`Match ${m.id} finished: ${match.resultText ?? ''}`);
          }
        } catch (err) {
          result.failed++;
          this.logger.error(`Live update failed for match ${m.id}: ${(err as Error).message}`);
        }
      }
      return result;
    } finally {
      this.running = false;
    }
  }
}
