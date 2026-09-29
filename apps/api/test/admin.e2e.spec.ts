import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/app-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { LIVE_BUS, InMemoryLiveBus } from '../src/live/live-bus';

const KEY = 'test-admin-key-123456';
const B1 = '11111111-1111-4111-8111-111111111111';
const T1 = '22222222-2222-4222-8222-222222222222';
const T2 = '33333333-3333-4333-8333-333333333333';
const M1 = '44444444-4444-4444-8444-444444444444';
const R1 = '55555555-5555-4555-8555-555555555555';
const MISSING = '99999999-9999-4999-8999-999999999999';

const broadcasterRow = { id: B1, name: 'JioHotstar', type: 'OTT', logoUrl: null, appDeeplinkTemplate: null, webUrlTemplate: 'https://www.hotstar.com', affiliateUrl: null, isActive: true, createdAt: new Date(), updatedAt: new Date(), _count: { rights: 2 } };
const tournamentRow = { id: T1, startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-10T00:00:00Z') };
const rightRow = (over = {}) => ({
  id: R1, broadcasterId: B1, tournamentId: T1, matchId: null, regionCode: 'IN', language: 'en', isFree: false,
  validFrom: new Date('2026-10-01T00:00:00Z'), validTo: new Date('2026-10-10T23:59:59.999Z'),
  broadcaster: { id: B1, name: 'JioHotstar' }, tournament: { id: T1, name: 'Series' }, match: null, ...over,
});

function createPrismaMock() {
  return {
    broadcaster: {
      findMany: jest.fn().mockResolvedValue([broadcasterRow]),
      findUnique: jest.fn(async ({ where }: any) => (where.id === B1 ? { id: B1 } : null)),
      create: jest.fn().mockResolvedValue({ id: B1 }),
      update: jest.fn().mockResolvedValue({ id: B1 }),
      delete: jest.fn().mockResolvedValue({}),
    },
    tournament: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === T1 ? tournamentRow : where.id === T2 ? { ...tournamentRow, id: T2 } : null)),
    },
    match: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === M1 ? { id: M1, tournamentId: T1 } : null)),
      findMany: jest.fn().mockResolvedValue([]),
    },
    broadcastRight: {
      findMany: jest.fn().mockResolvedValue([rightRow()]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(async ({ where }: any) => (where.id === R1 ? rightRow() : null)),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(async ({ data }: any) => rightRow({ ...data, id: R1 })),
      update: jest.fn(async ({ data }: any) => rightRow(data)),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('Admin API (e2e)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;
  const api = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) => req.set('X-Admin-Key', KEY);

  beforeAll(async () => {
    process.env.JOBS_ENABLED = 'false';
    process.env.ADMIN_API_KEY = KEY;
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(LIVE_BUS)
      .useValue(new InMemoryLiveBus())
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_API_KEY = KEY;
  });

  describe('admin key', () => {
    it('rejects missing and wrong keys with 401', async () => {
      await api().get('/v1/admin/broadcasters').expect(401);
      await api().get('/v1/admin/broadcasters').set('X-Admin-Key', 'wrong').expect(401);
      expect(prisma.broadcaster.findMany).not.toHaveBeenCalled();
    });

    it('disables the admin API with 503 when no key is configured', async () => {
      delete process.env.ADMIN_API_KEY;
      await api().get('/v1/admin/broadcasters').set('X-Admin-Key', KEY).expect(503);
    });

    it('lets the right key through', async () => {
      const res = await asAdmin(api().get('/v1/admin/broadcasters')).expect(200);
      expect(res.body[0]).toMatchObject({ name: 'JioHotstar', rightsCount: 2, isActive: true });
      expect(res.body[0]).not.toHaveProperty('_count');
    });
  });

  describe('broadcasters', () => {
    it('creates a broadcaster, trimming text and turning blank links into null', async () => {
      await asAdmin(api().post('/v1/admin/broadcasters'))
        .send({ name: '  FanCode ', type: 'OTT', webUrlTemplate: 'https://www.fancode.com/match/{providerMatchId}', appDeeplinkTemplate: '' })
        .expect(201);
      expect(prisma.broadcaster.create).toHaveBeenCalledWith({
        data: { name: 'FanCode', type: 'OTT', webUrlTemplate: 'https://www.fancode.com/match/{providerMatchId}', appDeeplinkTemplate: null },
      });
    });

    it.each([
      [{ type: 'OTT' }, /name must be/],
      [{ name: 'X', type: 'CABLE' }, /type must be one of/],
      [{ name: 'X', type: 'OTT', webUrlTemplate: 'http://x.com' }, /webUrlTemplate must start with https/],
      [{ name: 'X', type: 'OTT', webUrlTemplate: 'https://x.com/{id}' }, /unknown placeholder/],
      [{ name: 'X', type: 'OTT', appDeeplinkTemplate: 'javascript:alert(1)' }, /appDeeplinkTemplate must look like/],
      [{ name: 'X', type: 'OTT', logoUrl: 'ftp://x/logo.png' }, /logoUrl must be an https/],
      [{ name: 'X', type: 'OTT', rightsCount: 5 }, /should not exist/],
    ])('rejects %j with 400', async (body, message) => {
      const res = await asAdmin(api().post('/v1/admin/broadcasters')).send(body).expect(400);
      expect(JSON.stringify(res.body.message)).toMatch(message);
      expect(prisma.broadcaster.create).not.toHaveBeenCalled();
    });

    it('returns 409 for a duplicate name', async () => {
      prisma.broadcaster.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }));
      const res = await asAdmin(api().post('/v1/admin/broadcasters')).send({ name: 'JioHotstar', type: 'OTT' }).expect(409);
      expect(res.body.message).toMatch(/already exists/);
    });

    it('updates only the fields sent', async () => {
      await asAdmin(api().patch(`/v1/admin/broadcasters/${B1}`)).send({ isActive: false }).expect(200);
      expect(prisma.broadcaster.update).toHaveBeenCalledWith({ where: { id: B1 }, data: { isActive: false } });
    });

    it('refuses to delete a broadcaster that still has rights', async () => {
      prisma.broadcastRight.count.mockResolvedValueOnce(3);
      const res = await asAdmin(api().delete(`/v1/admin/broadcasters/${B1}`)).expect(409);
      expect(res.body.message).toMatch(/3 right\(s\)/);
      expect(prisma.broadcaster.delete).not.toHaveBeenCalled();
    });

    it('deletes a broadcaster with no rights', async () => {
      await asAdmin(api().delete(`/v1/admin/broadcasters/${B1}`)).expect(204);
      expect(prisma.broadcaster.delete).toHaveBeenCalledWith({ where: { id: B1 } });
    });

    it('404s for unknown broadcasters', async () => {
      await asAdmin(api().patch(`/v1/admin/broadcasters/${MISSING}`)).send({ isActive: false }).expect(404);
      await asAdmin(api().delete(`/v1/admin/broadcasters/${MISSING}`)).expect(404);
    });
  });

  describe('rights', () => {
    const base = { broadcasterId: B1, tournamentId: T1, regionCode: 'in', language: 'hi' };

    it('lists rights with filters', async () => {
      const res = await asAdmin(api().get(`/v1/admin/rights?tournament=${T1}&region=in`)).expect(200);
      expect(res.body[0]).toMatchObject({ broadcaster: { name: 'JioHotstar' }, tournament: { name: 'Series' }, match: null, regionCode: 'IN' });
      expect(prisma.broadcastRight.findMany.mock.calls[0][0].where).toEqual({ tournamentId: T1, regionCode: 'IN' });
    });

    it('creates a tournament-wide right, defaulting dates to the tournament', async () => {
      await asAdmin(api().post('/v1/admin/rights')).send(base).expect(201);
      expect(prisma.broadcastRight.create.mock.calls[0][0].data).toEqual({
        broadcasterId: B1, tournamentId: T1, matchId: null, regionCode: 'IN', language: 'hi', isFree: false,
        validFrom: new Date('2026-10-01T00:00:00Z'),
        validTo: new Date('2026-10-10T23:59:59.999Z'), // end date covers the whole day
      });
    });

    it('creates a single-match right and accepts date-only validity', async () => {
      await asAdmin(api().post('/v1/admin/rights')).send({ ...base, matchId: M1, isFree: true, validFrom: '2026-10-03', validTo: '2026-10-04' }).expect(201);
      const data = prisma.broadcastRight.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ matchId: M1, isFree: true });
      expect(data.validTo).toEqual(new Date('2026-10-04T23:59:59.999Z'));
    });

    it('checks that referenced records exist and belong together', async () => {
      const res = await asAdmin(api().post('/v1/admin/rights')).send({ ...base, broadcasterId: MISSING, tournamentId: T2, matchId: M1 }).expect(400);
      expect(res.body.message).toEqual(['broadcasterId does not match any broadcaster', 'matchId belongs to a different tournament']);
    });

    it('rejects an end date before the start date', async () => {
      const res = await asAdmin(api().post('/v1/admin/rights')).send({ ...base, validFrom: '2026-10-05', validTo: '2026-10-01' }).expect(400);
      expect(res.body.message).toEqual(['validFrom must be before validTo']);
    });

    it.each([
      [{ ...base, regionCode: 'IND' }, /regionCode must be a 2-letter/],
      [{ ...base, language: 'Hindi' }, /language must be a language code/],
      [{ ...base, validFrom: 'tomorrow' }, /validFrom must be an ISO date/],
      [{ ...base, tournamentId: 'x' }, /tournamentId must be a UUID/],
    ])('validates %j', async (body, message) => {
      const res = await asAdmin(api().post('/v1/admin/rights')).send(body).expect(400);
      expect(JSON.stringify(res.body.message)).toMatch(message);
    });

    it('returns 409 for a duplicate tournament-wide right (NULL match id)', async () => {
      prisma.broadcastRight.findFirst.mockResolvedValueOnce({ id: 'other' });
      const res = await asAdmin(api().post('/v1/admin/rights')).send(base).expect(409);
      expect(res.body.message).toMatch(/already has hi rights for this tournament in IN/);
      expect(prisma.broadcastRight.findFirst.mock.calls[0][0].where).toMatchObject({ matchId: null, regionCode: 'IN', language: 'hi' });
    });

    it('updates a right, excluding itself from the duplicate check', async () => {
      await asAdmin(api().patch(`/v1/admin/rights/${R1}`)).send({ isFree: true }).expect(200);
      expect(prisma.broadcastRight.findFirst.mock.calls[0][0].where.NOT).toEqual({ id: R1 });
      expect(prisma.broadcastRight.update.mock.calls[0][0].data).toMatchObject({ isFree: true, language: 'en', regionCode: 'IN' });
    });

    it('drops the old match when a right moves to another tournament', async () => {
      prisma.broadcastRight.findUnique.mockResolvedValueOnce(rightRow({ matchId: M1 }));
      await asAdmin(api().patch(`/v1/admin/rights/${R1}`)).send({ tournamentId: T2 }).expect(200);
      expect(prisma.broadcastRight.update.mock.calls[0][0].data).toMatchObject({ tournamentId: T2, matchId: null });
    });

    it('deletes a right, 404 if unknown', async () => {
      await asAdmin(api().delete(`/v1/admin/rights/${R1}`)).expect(204);
      await asAdmin(api().delete(`/v1/admin/rights/${MISSING}`)).expect(404);
    });
  });

  describe('rights gaps', () => {
    it('lists upcoming matches with no broadcaster, per region', async () => {
      prisma.match.findMany.mockResolvedValueOnce([
        { id: M1, providerMatchId: 'p1', tournamentId: T1, startTimeUtc: new Date('2026-10-05T14:00:00Z'), matchNo: 'Final', tournament: { name: 'Series' }, homeTeam: { shortCode: 'IND' }, awayTeam: { shortCode: 'AUS' } },
      ]);
      prisma.broadcastRight.findMany
        .mockResolvedValueOnce([]) // all rights: none
        .mockResolvedValueOnce([{ regionCode: 'GB' }]); // regions in use
      const res = await asAdmin(api().get('/v1/admin/rights/gaps?days=7')).expect(200);
      expect(res.body.map((g: any) => [g.regionCode, g.match.label])).toEqual([
        ['GB', 'IND v AUS · Final'],
        ['IN', 'IND v AUS · Final'],
      ]);
    });

    it('validates days', async () => {
      await asAdmin(api().get('/v1/admin/rights/gaps?days=365')).expect(400);
    });
  });
});
