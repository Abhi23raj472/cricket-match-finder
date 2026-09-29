import { describe, expect, it } from 'vitest';
import type { MatchDetailDto, Paginated, MatchSummaryDto, TournamentDetailDto, LiveScoreDto } from '@cmf/shared';
import { DemoNotFound, DemoServer } from '../demo/server';

const list = (s: DemoServer, qs = '') => s.handle(`/matches${qs}`, 'IN') as Promise<Paginated<MatchSummaryDto>>;

describe('DemoServer (GitHub Pages demo)', () => {
  it('serves the 10 sample matches, 2 live', async () => {
    const s = new DemoServer();
    expect((await list(s, '?pageSize=100')).total).toBe(10);
    expect((await list(s, '?status=live')).items).toHaveLength(2);
    const results = (await list(s, '?status=completed')).items;
    expect(results).toHaveLength(3);
    expect(Date.parse(results[0].startTimeUtc)).toBeGreaterThan(Date.parse(results[2].startTimeUtc)); // newest first
  });

  it('filters by tournament and team', async () => {
    const s = new DemoServer();
    expect((await list(s, '?tournament=mock-series-quad&pageSize=100')).total).toBe(5);
    const india = (await list(s, '?team=mock-team-ind&pageSize=100')).items;
    expect(india.every((m) => m.homeTeam.id === 'mock-team-ind' || m.awayTeam.id === 'mock-team-ind')).toBe(true);
  });

  it('applies the real Watch-on rules, including the single-match override', async () => {
    const s = new DemoServer();
    const quad = (await s.handle('/matches/mock-match-quad-1', 'IN')) as MatchDetailDto;
    expect(quad.watchOptions.map((o) => `${o.name}/${o.language}`)).toEqual(['DD Sports/hi', 'JioHotstar/en', 'JioHotstar/hi']);
    const override = (await s.handle('/matches/mock-match-trophy-4', 'IN')) as MatchDetailDto;
    expect(override.watchOptions.map((o) => o.name)).toEqual(['SonyLIV']);
    const uk = (await s.handle('/matches/mock-match-quad-1', 'GB')) as MatchDetailDto;
    expect(uk.watchOptions).toEqual([]);
  });

  it('advances live matches each tick and tells subscribers', async () => {
    const s = new DemoServer();
    const id = (await list(s, '?status=live')).items[0].id;
    const updates: LiveScoreDto[] = [];
    s.subscribe(id, (u) => updates.push(u));
    await s.tick();
    await s.tick();
    expect(updates).toHaveLength(2);
    expect(updates[1].commentary[0]).not.toEqual(updates[0].commentary[0]);
  });

  it('builds a points table from finished matches', async () => {
    const s = new DemoServer();
    const t = (await s.handle('/tournaments/mock-series-quad', 'IN')) as TournamentDetailDto;
    expect(t.standings).toHaveLength(4);
    expect(t.standings.reduce((n, r) => n + r.points, 0)).toBe(4); // 2 completed matches x 2 points
  });

  it('404s unknown routes and ids', async () => {
    const s = new DemoServer();
    await expect(s.handle('/matches/nope', 'IN')).rejects.toBeInstanceOf(DemoNotFound);
    await expect(s.handle('/nowhere', 'IN')).rejects.toBeInstanceOf(DemoNotFound);
  });
});
