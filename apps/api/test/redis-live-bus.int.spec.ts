import Redis from 'ioredis';
import { firstValueFrom } from 'rxjs';
import { RedisLiveBus } from '../src/live/live-bus';
import type { LiveScoreDto } from '@cmf/shared';

const url = process.env.REDIS_URL ?? 'redis://localhost:6379';

async function redisAvailable() {
  const r = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 0, retryStrategy: () => null });
  try {
    await r.connect();
    await r.ping();
    return true;
  } catch {
    return false;
  } finally {
    r.disconnect();
  }
}

const sample = (matchId: string): LiveScoreDto => ({
  matchId,
  status: 'live',
  tossText: null,
  innings: [],
  currentBatters: [],
  currentBowler: null,
  lastSixBalls: ['1', '4'],
  commentary: [],
  updatedAt: new Date().toISOString(),
});

describe('RedisLiveBus (needs Redis; skipped if not running)', () => {
  let available = false;
  beforeAll(async () => {
    available = await redisAvailable();
  });

  it('caches and fans out updates for one match only', async () => {
    if (!available) return console.warn(`Redis not reachable at ${url}; skipping`);
    const bus = new RedisLiveBus(url);
    const listener = new RedisLiveBus(url); // a second API instance
    const id = `test-${Date.now()}`;
    try {
      const received = firstValueFrom(listener.stream(id));
      await listener.ready();

      await bus.publish(sample(`${id}-other`));
      await bus.publish(sample(id));

      expect((await received).matchId).toBe(id);
      expect((await listener.getCached(id))?.lastSixBalls).toEqual(['1', '4']);
      expect(await listener.getCached('missing')).toBeNull();
    } finally {
      const r = new Redis(url);
      const keys = await r.keys(`cmf:live:${id}*`);
      if (keys.length) await r.del(...keys);
      await r.quit();
      await bus.close();
      await listener.close();
    }
  });
});
