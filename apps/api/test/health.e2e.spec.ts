import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('GET /v1/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
