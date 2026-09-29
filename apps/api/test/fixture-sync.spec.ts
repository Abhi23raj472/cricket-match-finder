import { ConfigService } from '@nestjs/config';
import { FixtureSyncService, nextStatus } from '../src/sync/fixture-sync.service';
import { MockCricketProvider } from '../src/provider/mock/mock-cricket.provider';
import { createFakePrisma } from './helpers/fake-prisma';

const config = new ConfigService({ JOBS_ENABLED: 'false' });

describe('nextStatus', () => {
  it('never moves a match backwards', () => {
    expect(nextStatus(undefined, 'upcoming')).toBe('upcoming');
    expect(nextStatus('upcoming', 'live')).toBe('live');
    expect(nextStatus('live', 'upcoming')).toBe('live');
    expect(nextStatus('completed', 'live')).toBe('completed');
    expect(nextStatus('live', 'abandoned')).toBe('abandoned');
  });
});

describe('FixtureSyncService', () => {
  it('creates everything on the first run and only updates on the second', async () => {
    const prisma = createFakePrisma();
    const sync = new FixtureSyncService(prisma as any, new MockCricketProvider(), config);

    const first = await sync.sync();
    expect(first).toMatchObject({ fixtures: 10, teams: 8, venues: 5, tournaments: 2, matchesCreated: 10, matchesUpdated: 0 });
    expect(prisma.team.rows.size).toBe(8);
    expect(prisma.match.rows.size).toBe(10);
    expect(await prisma.match.count({ where: { status: 'live' } })).toBe(2);

    const second = await sync.sync();
    expect(second).toMatchObject({ matchesCreated: 0, matchesUpdated: 10 });
    expect(prisma.team.rows.size).toBe(8);
    expect(prisma.match.rows.size).toBe(10);
  });

  it('links matches to the right teams, venue and tournament', async () => {
    const prisma = createFakePrisma();
    await new FixtureSyncService(prisma as any, new MockCricketProvider(), config).sync();
    const m = [...prisma.match.rows.values()].find((r) => r.providerMatchId === 'mock-match-quad-1')!;
    expect(prisma.team.rows.get(m.homeTeamId)!.name).toBe('India');
    expect(prisma.team.rows.get(m.awayTeamId)!.name).toBe('Australia');
    expect(prisma.venue.rows.get(m.venueId)!.city).toBe('Mohali');
    expect(prisma.tournament.rows.get(m.tournamentId)!.providerSeriesId).toBe('mock-series-quad');
  });

  it('does not reset a match the poller already finished', async () => {
    const prisma = createFakePrisma();
    const sync = new FixtureSyncService(prisma as any, new MockCricketProvider(), config);
    await sync.sync();
    const live = [...prisma.match.rows.values()].find((r) => r.status === 'live')!;
    live.status = 'completed';
    await sync.sync();
    expect(prisma.match.rows.get(live.id)!.status).toBe('completed');
  });
});
