import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { firstValueFrom, take, toArray } from 'rxjs';
import { FixtureSyncService } from '../src/sync/fixture-sync.service';
import { LivePollerService } from '../src/live/live-poller.service';
import { InMemoryLiveBus } from '../src/live/live-bus';
import { MockCricketProvider } from '../src/provider/mock/mock-cricket.provider';
import { matches as mockMatches } from '../src/provider/mock/mock-data';
import { createFakePrisma } from './helpers/fake-prisma';

const config = new ConfigService({ JOBS_ENABLED: 'false' });

async function setup(clock = () => Date.now()) {
  const prisma = createFakePrisma();
  const provider = new MockCricketProvider({ now: clock });
  await new FixtureSyncService(prisma as any, provider, config).sync();
  const bus = new InMemoryLiveBus();
  const poller = new LivePollerService(prisma as any, provider, bus, config, new SchedulerRegistry());
  return { prisma, bus, poller };
}

describe('LivePollerService', () => {
  it('saves and publishes a scorecard for each live match', async () => {
    const { prisma, bus, poller } = await setup();
    const liveMatch = [...prisma.match.rows.values()].find((m) => m.status === 'live')!;
    const received = firstValueFrom(bus.stream(liveMatch.id));

    const result = await poller.poll();

    expect(result).toEqual({ checked: 2, updated: 2, finished: 0, failed: 0 });
    expect(prisma.liveScore.rows.size).toBe(2);
    const update = await received;
    expect(update.matchId).toBe(liveMatch.id);
    expect(update.innings.every((i) => [liveMatch.homeTeamId, liveMatch.awayTeamId].includes(i.battingTeamId))).toBe(true);
    expect(await bus.getCached(liveMatch.id)).toEqual(update);
  });

  it('publishes a new update on every poll', async () => {
    const { prisma, bus, poller } = await setup();
    const liveMatch = [...prisma.match.rows.values()].find((m) => m.status === 'live')!;
    const three = firstValueFrom(bus.stream(liveMatch.id).pipe(take(3), toArray()));
    await poller.poll();
    await poller.poll();
    await poller.poll();
    const updates = await three;
    expect(new Set(updates.map((u) => JSON.stringify(u.commentary[0]))).size).toBeGreaterThan(1);
  });

  it('marks matches completed when the provider finishes them', async () => {
    const { prisma, poller } = await setup();
    let finished = 0;
    for (let i = 0; i < 500 && (await prisma.match.count({ where: { status: 'live' } })) > 0; i++) {
      finished += (await poller.poll()).finished;
    }
    expect(finished).toBe(2);
    const done = await prisma.match.findMany({ where: { status: 'completed' } });
    expect(done).toHaveLength(5); // 3 already completed + 2 finished
    expect(done.every((m) => m.resultText)).toBe(true);
  });

  it('picks up an upcoming match once its start time passes', async () => {
    let clock = Date.now();
    const { prisma, poller } = await setup(() => clock);
    const next = mockMatches.filter((m) => m.status === 'upcoming').sort((a, b) => a.start.getTime() - b.start.getTime())[0];
    clock = next.start.getTime() + 60_000;

    await poller.poll(new Date(clock));

    const row = [...prisma.match.rows.values()].find((m) => m.providerMatchId === `mock-match-${next.key}`)!;
    expect(row.status).toBe('live');
    expect(row.tossText).toMatch(/won the toss/);
    expect(prisma.liveScore.rows.get(row.id)).toBeDefined();
  });

  it('keeps going when one match fails', async () => {
    const { prisma, poller } = await setup();
    const live = [...prisma.match.rows.values()].filter((m) => m.status === 'live');
    // Break one match's team link so mapping throws
    const broken = live[0];
    prisma.team.rows.get(broken.homeTeamId)!.providerTeamId = 'someone-else';
    const result = await poller.poll();
    expect(result.failed).toBe(1);
    expect(result.updated).toBe(1);
  });
});
