/**
 * Live score cache + fan-out.
 *
 * The poller calls publish(); the SSE endpoint (Step 4) calls stream().
 * Redis pub/sub lets several API instances share one poller: whichever
 * instance polls publishes, and every instance forwards to its own clients.
 */
import { Observable, Subject, filter, map } from 'rxjs';
import Redis from 'ioredis';
import type { LiveScoreDto } from '@cmf/shared';

export const LIVE_BUS = Symbol('LIVE_BUS');

export interface LiveBus {
  publish(score: LiveScoreDto): Promise<void>;
  getCached(matchId: string): Promise<LiveScoreDto | null>;
  stream(matchId: string): Observable<LiveScoreDto>;
  close(): Promise<void>;
}

const CHANNEL = 'cmf:live';
const cacheKey = (matchId: string) => `cmf:live:${matchId}`;
const CACHE_TTL_SECONDS = 6 * 60 * 60;

/** Single-process bus for tests and running without Redis. */
export class InMemoryLiveBus implements LiveBus {
  private readonly cache = new Map<string, LiveScoreDto>();
  private readonly events = new Subject<LiveScoreDto>();

  async publish(score: LiveScoreDto) {
    this.cache.set(score.matchId, score);
    this.events.next(score);
  }

  async getCached(matchId: string) {
    return this.cache.get(matchId) ?? null;
  }

  stream(matchId: string) {
    return this.events.pipe(filter((s) => s.matchId === matchId));
  }

  async close() {
    this.events.complete();
  }
}

/** Redis-backed bus: SET for the cache, one PUB/SUB channel for updates. */
export class RedisLiveBus implements LiveBus {
  private readonly pub: Redis;
  private sub?: Redis;
  private readonly events = new Subject<string>();

  constructor(private readonly url: string) {
    this.pub = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  }

  async publish(score: LiveScoreDto) {
    const payload = JSON.stringify(score);
    await this.pub.multi().set(cacheKey(score.matchId), payload, 'EX', CACHE_TTL_SECONDS).publish(CHANNEL, payload).exec();
  }

  async getCached(matchId: string) {
    const raw = await this.pub.get(cacheKey(matchId));
    return raw ? (JSON.parse(raw) as LiveScoreDto) : null;
  }

  stream(matchId: string) {
    this.ensureSubscribed();
    return this.events.pipe(
      map((raw) => JSON.parse(raw) as LiveScoreDto),
      filter((s) => s.matchId === matchId),
    );
  }

  /** Resolves once the subscriber is listening (useful in tests). */
  async ready() {
    this.ensureSubscribed();
    await this.subscribed;
  }

  private subscribed?: Promise<unknown>;
  private ensureSubscribed() {
    if (this.sub) return;
    this.sub = new Redis(this.url, { maxRetriesPerRequest: 2 });
    this.sub.on('message', (_channel, message) => this.events.next(message));
    this.subscribed = this.sub.subscribe(CHANNEL);
  }

  async close() {
    this.events.complete();
    await Promise.allSettled([this.pub.quit(), this.sub?.quit()]);
  }
}

export function createLiveBus(redisUrl: string | undefined): LiveBus {
  return redisUrl ? new RedisLiveBus(redisUrl) : new InMemoryLiveBus();
}
