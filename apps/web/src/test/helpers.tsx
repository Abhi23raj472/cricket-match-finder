import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { MatchDetailDto, MatchSummaryDto } from '@cmf/shared';
import { Layout } from '../components/Layout';
import { App } from '../App';

/** Routes fetch() by path (query ignored unless the handler reads it); records URLs and headers. */
export function mockApi(routes: Record<string, unknown | ((url: URL) => unknown)>) {
  const calls: { url: URL; headers: Record<string, string> }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      calls.push({ url, headers: (init.headers ?? {}) as Record<string, string> });
      const key = url.pathname.replace(/^\/v1/, '');
      if (!(key in routes)) return new Response(JSON.stringify({ message: 'nope' }), { status: 404 });
      const r = routes[key];
      return new Response(JSON.stringify(typeof r === 'function' ? (r as (u: URL) => unknown)(url) : r), { status: 200 });
    }),
  );
  return calls;
}

/** Minimal EventSource stand-in; tests push events with emit(). */
export class FakeEventSource {
  static last: FakeEventSource | null = null;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeEventSource.last = this;
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown) {
    for (const fn of this.listeners[type] ?? []) fn(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
}

export function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
export { Layout, MemoryRouter, Route, Routes };

export const IND = { id: 'ind', name: 'India', shortCode: 'IND' };
export const ENG = { id: 'eng', name: 'England', shortCode: 'ENG' };

export const summary = (over: Partial<MatchSummaryDto> = {}): MatchSummaryDto => ({
  id: 'm1',
  tournament: { id: 't1', name: 'Quad Series', format: 'T20' },
  homeTeam: IND,
  awayTeam: ENG,
  venue: { name: 'Wankhede Stadium', city: 'Mumbai' },
  matchNo: '3rd T20',
  startTimeUtc: new Date(Date.now() - 3_600_000).toISOString(),
  status: 'live',
  resultText: null,
  scores: [
    { teamId: 'ind', runs: 201, wickets: 4, overs: '20.0' },
    { teamId: 'eng', runs: 97, wickets: 3, overs: '11.2' },
  ],
  ...over,
});

export const detail = (over: Partial<MatchDetailDto> = {}): MatchDetailDto => ({
  ...summary(),
  watchOptions: [
    { broadcasterId: 'dd', name: 'DD Sports', type: 'FREE', language: 'hi', isFree: true, isSubscribed: false, deepLink: null, webUrl: null, affiliateUrl: null },
    { broadcasterId: 'hs', name: 'JioHotstar', type: 'OTT', language: 'en', isFree: false, isSubscribed: false, deepLink: null, webUrl: 'https://www.hotstar.com', affiliateUrl: null },
  ],
  live: {
    matchId: 'm1',
    status: 'live',
    tossText: 'India won the toss',
    innings: [
      { battingTeamId: 'ind', runs: 201, wickets: 4, overs: '20.0', batting: [], bowling: [] },
      { battingTeamId: 'eng', runs: 97, wickets: 3, overs: '11.2', batting: [{ name: 'Batter E', runs: 41, balls: 28, fours: 3, sixes: 1, dismissal: null }], bowling: [] },
    ],
    currentBatters: [{ name: 'Batter E', runs: 41, balls: 28, fours: 3, sixes: 1, dismissal: null }],
    currentBowler: { name: 'Bowler X', overs: '2.2', maidens: 0, runs: 19, wickets: 1 },
    lastSixBalls: ['1', '4', 'W', '0', '6', '1'],
    commentary: [{ over: '11.2', text: 'Driven to long-on for one.' }],
    updatedAt: new Date().toISOString(),
  },
  ...over,
});
