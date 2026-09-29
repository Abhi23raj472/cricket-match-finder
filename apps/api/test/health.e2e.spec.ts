import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { LIVE_BUS, InMemoryLiveBus } from '../src/live/live-bus';

describe('GET /v1/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JOBS_ENABLED = 'false'; // no background jobs in this test
    // Health check doesn't touch the database, so stub Prisma out.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(LIVE_BUS)
      .useValue(new InMemoryLiveBus())
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => app.close());

  it('returns ok with default region and timezone', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', defaultRegion: 'IN', defaultTimezone: 'Asia/Kolkata' });
  });
});
