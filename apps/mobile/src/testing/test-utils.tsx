import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import type { MatchDetailDto, MatchSummaryDto } from '@cmf/shared';
import { DEFAULT_PREFS, PrefsProvider, type Prefs } from '../prefs';

export const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
export let params: Record<string, string> = {};
export const setParams = (p: Record<string, string>) => {
  params = p;
};

/** Routes fetch() by path (ignores host and query) and records every URL. */
export function mockFetch(routes: Record<string, unknown>) {
  const urls: string[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    urls.push(url.pathname + url.search);
    const key = url.pathname.replace(/^\/v1/, '');
    if (!(key in routes)) return new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
    const body = routes[key];
    return new Response(JSON.stringify(typeof body === 'function' ? (body as (u: URL) => unknown)(url) : body), { status: 200 });
  }) as jest.Mock;
  return urls;
}

export function renderWithPrefs(ui: ReactElement, prefs: Partial<Prefs> = {}) {
  return render(<PrefsProvider initial={{ ...DEFAULT_PREFS, onboarded: true, ...prefs }}>{ui}</PrefsProvider>);
}

export const IND = { id: 'ind', name: 'India', shortCode: 'IND' };
export const AUS = { id: 'aus', name: 'Australia', shortCode: 'AUS' };

export const summary = (over: Partial<MatchSummaryDto> = {}): MatchSummaryDto => ({
  id: 'm1',
  tournament: { id: 't1', name: 'Quad Series', format: 'T20' },
  homeTeam: IND,
  awayTeam: AUS,
  venue: { name: 'IS Bindra Stadium', city: 'Mohali' },
  matchNo: '3rd T20',
  startTimeUtc: '2026-10-01T14:00:00Z',
  status: 'live',
  resultText: null,
  scores: [{ teamId: 'ind', runs: 201, wickets: 4, overs: '20.0' }, { teamId: 'aus', runs: 97, wickets: 3, overs: '11.2' }],
  ...over,
});

export const detail = (over: Partial<MatchDetailDto> = {}): MatchDetailDto => ({
  ...summary(),
  watchOptions: [
    { broadcasterId: 'dd', name: 'DD Sports', type: 'FREE', language: 'hi', isFree: true, isSubscribed: false, deepLink: null, webUrl: null, affiliateUrl: null },
    { broadcasterId: 'hs', name: 'JioHotstar', type: 'OTT', language: 'en', isFree: false, isSubscribed: false, deepLink: 'hotstar://m/1', webUrl: 'https://www.hotstar.com', affiliateUrl: null },
  ],
  live: {
    matchId: 'm1',
    status: 'live',
    tossText: 'India won the toss and chose to bat',
    innings: [
      { battingTeamId: 'ind', runs: 201, wickets: 4, overs: '20.0', batting: [{ name: 'Batter A', runs: 88, balls: 52, fours: 7, sixes: 3, dismissal: 'c X b Y' }], bowling: [{ name: 'Bowler V', overs: '4.0', maidens: 0, runs: 41, wickets: 2 }] },
      { battingTeamId: 'aus', runs: 97, wickets: 3, overs: '11.2', batting: [{ name: 'Batter E', runs: 41, balls: 28, fours: 4, sixes: 1, dismissal: null }], bowling: [] },
    ],
    currentBatters: [{ name: 'Batter E', runs: 41, balls: 28, fours: 4, sixes: 1, dismissal: null }],
    currentBowler: { name: 'Bowler X', overs: '2.2', maidens: 0, runs: 19, wickets: 1 },
    lastSixBalls: ['1', '4', 'W', '0', '6', '1'],
    commentary: [{ over: '11.2', text: 'Driven to long-on for a single.' }],
    updatedAt: '2026-10-01T15:30:00Z',
  },
  ...over,
});
