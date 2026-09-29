/**
 * HTTP tests for the Step 4 endpoints: real Nest app + validation pipeline,
 * with the database replaced by jest mocks and an in-memory live bus.
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import type { LiveScoreDto } from '@cmf/shared';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { LIVE_BUS, InMemoryLiveBus } from '../src/live/live-bus';

const MATCH_ID = '11111111-1111-4111-8111-111111111111';
const DONE_ID = '22222222-2222-4222-8222-222222222222';
const T_ID = '33333333-3333-4333-8333-333333333333';
const MISSING = '99999999-9999-4999-8999-999999999999';

const team = (id: string, name: string) => ({ id, name, shortCode: name.slice(0, 3).toUpperCase(), country: name, logoUrl: null });
const IND = team('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'India');
const AUS = team('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Australia');

const matchRow = (id: string, status: string, innings: unknown[] = []) => ({
  id,
  providerMatchId: `prov-${id.slice(0, 4)}`,
  matchNo: '1st T20',
  startTimeUtc: new Date('2026-10-01T14:00:00Z'),
  status,
  tossText: 'India won the toss',
  resultText: status === 'completed' ? 'India won by 10 runs' : null,
  tournamentId: T_ID,
  tournament: { id: T_ID, name: 'Series', format: 'T20' },
  homeTeam: IND,
  awayTeam: AUS,
  venue: { name: 'IS Bindra Stadium', city: 'Mohali' },
  liveScore: innings.length
    ? { matchId: id, innings, currentBatters: [], currentBowler: null, lastSixBalls: ['1'], commentary: [], updatedAt: new Date('2026-10-01T15:00:00Z') }
    : null,
});

const liveRow = matchRow(MATCH_ID, 'live', [{ battingTeamId: IND.id, runs: 88, wickets: 2, overs: '10.0', batting: [], bowling: [] }]);
const doneRow = matchRow(DONE_ID, 'completed', [
  { battingTeamId: IND.id, runs: 170, wickets: 5, overs: '20.0', batting: [], bowling: [] },
  { battingTeamId: AUS.id, runs: 160, wickets: 9, overs: '20.0', batting: [], bowling: [] },
]);

const broadcaster = (id: string, name: string, extra = {}) => ({
  id, name, type: 'OTT', logoUrl: null, appDeeplinkTemplate: null, webUrlTemplate: `https://example.com/${name}`, affiliateUrl: null, isActive: true, ...extra,
});

function createPrismaMock() {
  const rows: Record<string, ReturnType<typeof matchRow>> = { [MATCH_ID]: liveRow, [DONE_ID]: doneRow };
  return {
    match: {
      findMany: jest.fn().mockResolvedValue([liveRow, doneRow]),
      count: jest.fn().mockResolvedValue(2),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => rows[where.id] ?? null),
    },
    broadcastRight: {
      findMany: jest.fn().mockResolvedValue([
        { matchId: null, language: 'en', isFree: false, broadcaster: broadcaster('b1', 'JioHotstar') },
        { matchId: null, language: 'hi', isFree: true, broadcaster: broadcaster('b2', 'DD Sports', { type: 'FREE' }) },
      ]),
    },
    tournament: {
      findMany: jest.fn().mockResolvedValue([
        { id: T_ID, name: 'Series', format: 'T20', season: '2026', startDate: new Date('2026-09-28'), endDate: new Date('2026-10-10'), matches: [{ status: 'live' }, { status: 'completed' }] },
      ]),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === T_ID
          ? {
              id: T_ID, name: 'Series', format: 'T20', season: '2026', startDate: new Date('2026-09-28'), endDate: new Date('2026-10-10'),
              matches: [liveRow, doneRow].map((m) => ({ status: m.status, homeTeamId: IND.id, awayTeamId: AUS.id, homeTeam: IND, awayTeam: AUS, liveScore: m.liveScore })),
            }
          : null,
      ),
    },
    team: { findMany: jest.fn().mockResolvedValue([AUS, IND]) },
    broadcaster: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'b2', name: 'DD Sports', type: 'FREE', logoUrl: null },
        { id: 'b1', name: 'JioHotstar', type: 'OTT', logoUrl: null },
      ]),
    },
  };
}

/** Opens an SSE stream and resolves with the parsed events once `until` is satisfied or the stream ends. */
function readSse(baseUrl: string, path: string, until: (events: { event: string; data: any }[]) => boolean, onOpen?: () => void) {
  return new Promise<{ status: number; contentType?: string; events: { event: string; data: any }[]; ended: boolean }>((resolve, reject) => {
    const events: { event: string; data: any }[] = [];
    let timer: NodeJS.Timeout;
    const req = http.get(baseUrl + path, (res) => {
      let buf = '';
      const finish = (ended: boolean) => {
        clearTimeout(timer);
        req.destroy();
        resolve({ status: res.statusCode!, contentType: res.headers['content-type'], events, ended });
      };
      onOpen?.();
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        buf += chunk;
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const event = /^event: (.*)$/m.exec(block)?.[1] ?? 'message';
          const dataLine = /^data: (.*)$/m.exec(block)?.[1];
          if (dataLine !== undefined) events.push({ event, data: safeJson(dataLine) });
          if (until(events)) return finish(false);
        }
      });
      res.on('end', () => finish(true));
    });
    req.on('error', reject);
    timer = setTimeout(() => {
      req.destroy();
      resolve({ status: -1, events, ended: false });
    }, 4000);
  });
}
const safeJson = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
};

describe('API v1 (e2e)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;
  let bus: InMemoryLiveBus;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.JOBS_ENABLED = 'false';
    prisma = createPrismaMock();
    bus = new InMemoryLiveBus();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(LIVE_BUS)
      .useValue(bus)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  describe('GET /v1/matches', () => {
    it('returns a page of match summaries', async () => {
      const res = await request(app.getHttpServer()).get('/v1/matches').expect(200);
      expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 20 });
      expect(res.body.items[0]).toMatchObject({
        id: MATCH_ID,
        status: 'live',
        homeTeam: { name: 'India' },
        scores: [{ teamId: IND.id, runs: 88, wickets: 2, overs: '10.0' }],
      });
    });

    it('passes filters, paging and the viewer time zone to the query', async () => {
      await request(app.getHttpServer())
        .get(`/v1/matches?status=live&tournament=${T_ID}&team=${IND.id}&date=2026-10-01&page=2&pageSize=5`)
        .set('X-Timezone', 'UTC')
        .expect(200);
      const args = prisma.match.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        status: 'live',
        tournamentId: T_ID,
        OR: [{ homeTeamId: IND.id }, { awayTeamId: IND.id }],
        startTimeUtc: { gte: new Date('2026-10-01T00:00:00Z'), lt: new Date('2026-10-02T00:00:00Z') },
      });
      expect(args.skip).toBe(5);
      expect(args.take).toBe(5);
    });

    it.each([
      ['status=finished', /status must be one of/],
      ['tournament=abc', /tournament must be a tournament id/],
      ['team=123', /team must be a team id/],
      ['date=01-10-2026', /date must be YYYY-MM-DD/],
      ['pageSize=500', /pageSize must not be greater than 100/],
      ['page=0', /page must not be less than 1/],
      ['colour=blue', /property colour should not exist/],
    ])('rejects %s with 400', async (qs, message) => {
      const res = await request(app.getHttpServer()).get(`/v1/matches?${qs}`).expect(400);
      expect(JSON.stringify(res.body.message)).toMatch(message);
      expect(prisma.match.findMany).not.toHaveBeenCalled();
    });

    it('rejects a bad X-Region header', async () => {
      await request(app.getHttpServer()).get('/v1/matches').set('X-Region', 'India').expect(400);
    });
  });

  describe('GET /v1/matches/:id', () => {
    it('returns the match with watch options for the viewer region and the live score', async () => {
      const res = await request(app.getHttpServer()).get(`/v1/matches/${MATCH_ID}`).set('X-Region', 'in').expect(200);
      expect(res.body.watchOptions.map((o: any) => o.name)).toEqual(['DD Sports', 'JioHotstar']); // free first
      expect(res.body.watchOptions[1]).toMatchObject({ webUrl: 'https://example.com/JioHotstar', isSubscribed: false });
      expect(res.body.live).toMatchObject({ matchId: MATCH_ID, status: 'live', innings: [{ runs: 88 }] });

      const where = prisma.broadcastRight.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ tournamentId: T_ID, regionCode: 'IN', OR: [{ matchId: null }, { matchId: MATCH_ID }] });
    });

    it('prefers the live cache over the database for the score', async () => {
      const fresher: LiveScoreDto = { matchId: MATCH_ID, status: 'live', tossText: null, innings: [], currentBatters: [], currentBowler: null, lastSixBalls: ['6'], commentary: [], updatedAt: '2026-10-01T15:05:00Z' };
      await bus.publish(fresher);
      const res = await request(app.getHttpServer()).get(`/v1/matches/${MATCH_ID}`).expect(200);
      expect(res.body.live.lastSixBalls).toEqual(['6']);
    });

    it('404s for an unknown match and 400s for a non-UUID id', async () => {
      await request(app.getHttpServer()).get(`/v1/matches/${MISSING}`).expect(404);
      await request(app.getHttpServer()).get('/v1/matches/not-a-uuid').expect(400);
    });
  });

  describe('GET /v1/matches/:id/live (SSE)', () => {
    it('sends the current score, then each published update, and ends after the result', async () => {
      const update = (over: Partial<LiveScoreDto>): LiveScoreDto => ({
        matchId: MATCH_ID, status: 'live', tossText: null, innings: [], currentBatters: [], currentBowler: null, lastSixBalls: [], commentary: [], updatedAt: new Date().toISOString(), ...over,
      });
      const result = await readSse(
        baseUrl,
        `/v1/matches/${MATCH_ID}/live`,
        () => false, // read until the server closes the stream
        () =>
          setTimeout(async () => {
            await bus.publish(update({ lastSixBalls: ['4'] }));
            await bus.publish(update({ matchId: MISSING, lastSixBalls: ['other match'] })); // must be filtered out
            await bus.publish(update({ status: 'completed', lastSixBalls: ['W'] }));
          }, 100),
      );
      expect(result.status).toBe(200);
      expect(result.contentType).toMatch(/text\/event-stream/);
      expect(result.ended).toBe(true);
      const scores = result.events.filter((e) => e.event === 'score').map((e) => e.data);
      expect(scores.map((s) => s.lastSixBalls[0])).toEqual(['6', '4', 'W']); // snapshot (cached), update, final
      expect(scores.every((s) => s.matchId === MATCH_ID)).toBe(true);
    });

    it('sends one snapshot and closes for a finished match', async () => {
      const result = await readSse(baseUrl, `/v1/matches/${DONE_ID}/live`, () => false);
      expect(result.ended).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].data).toMatchObject({ matchId: DONE_ID, status: 'completed' });
    });

    it('404s for an unknown match', async () => {
      await request(app.getHttpServer()).get(`/v1/matches/${MISSING}/live`).expect(404);
    });
  });

  describe('GET /v1/tournaments', () => {
    it('lists current tournaments with match counts', async () => {
      const res = await request(app.getHttpServer()).get('/v1/tournaments').expect(200);
      expect(res.body).toEqual([
        { id: T_ID, name: 'Series', format: 'T20', season: '2026', startDate: '2026-09-28', endDate: '2026-10-10', matchCount: 2, liveCount: 1 },
      ]);
      expect(prisma.tournament.findMany.mock.calls[0][0].where).toHaveProperty('endDate');
    });

    it('includes finished tournaments with ?all=true and validates the flag', async () => {
      await request(app.getHttpServer()).get('/v1/tournaments?all=true').expect(200);
      expect(prisma.tournament.findMany.mock.calls[0][0].where).toEqual({});
      await request(app.getHttpServer()).get('/v1/tournaments?all=yes').expect(400);
    });

    it('returns a tournament with its points table', async () => {
      const res = await request(app.getHttpServer()).get(`/v1/tournaments/${T_ID}`).expect(200);
      expect(res.body.standings.map((r: any) => [r.team.name, r.played, r.points])).toEqual([
        ['India', 1, 2],
        ['Australia', 1, 0],
      ]);
      expect(res.body.standings[0].netRunRate).toBe(0.5);
    });

    it('404s for an unknown tournament', async () => {
      await request(app.getHttpServer()).get(`/v1/tournaments/${MISSING}`).expect(404);
    });
  });

  describe('GET /v1/teams', () => {
    it('lists teams A-Z', async () => {
      const res = await request(app.getHttpServer()).get('/v1/teams').expect(200);
      expect(res.body.map((t: any) => t.name)).toEqual(['Australia', 'India']);
      expect(prisma.team.findMany.mock.calls[0][0].orderBy).toEqual({ name: 'asc' });
    });
  });

  describe('GET /v1/broadcasters', () => {
    it('lists active broadcasters', async () => {
      const res = await request(app.getHttpServer()).get('/v1/broadcasters').expect(200);
      expect(res.body.map((b: any) => b.name)).toEqual(['DD Sports', 'JioHotstar']);
      expect(prisma.broadcaster.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
    });
  });
});
