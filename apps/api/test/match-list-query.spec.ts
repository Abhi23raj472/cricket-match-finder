import { buildMatchListQuery } from '../src/matches/matches.service';
import { toMatchSummary, type MatchRow } from '../src/matches/match.mapper';
import type { ListMatchesQuery } from '../src/matches/dto/list-matches.query';

const q = (over: Partial<ListMatchesQuery> = {}) => ({ page: 1, pageSize: 20, ...over }) as ListMatchesQuery;

describe('buildMatchListQuery', () => {
  it('with no filters: everything, soonest first, first page', () => {
    expect(buildMatchListQuery(q(), 'Asia/Kolkata')).toEqual({
      where: {},
      orderBy: [{ startTimeUtc: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 20,
    });
  });

  it('applies status, tournament, team and paging', () => {
    const r = buildMatchListQuery(q({ status: 'live', tournament: 't-1', team: 'team-1', page: 3, pageSize: 10 }), 'UTC');
    expect(r.where).toEqual({ status: 'live', tournamentId: 't-1', OR: [{ homeTeamId: 'team-1' }, { awayTeamId: 'team-1' }] });
    expect(r.skip).toBe(20);
    expect(r.take).toBe(10);
  });

  it('shows results newest first', () => {
    expect(buildMatchListQuery(q({ status: 'completed' }), 'UTC').orderBy[0]).toEqual({ startTimeUtc: 'desc' });
  });

  it('filters a calendar day in the viewer time zone', () => {
    const r = buildMatchListQuery(q({ date: '2026-10-01' }), 'Asia/Kolkata');
    expect(r.where.startTimeUtc).toEqual({ gte: new Date('2026-09-30T18:30:00Z'), lt: new Date('2026-10-01T18:30:00Z') });
  });
});

describe('toMatchSummary', () => {
  const base: MatchRow = {
    id: 'm-1', providerMatchId: 'p-1', matchNo: '1st T20', startTimeUtc: new Date('2026-10-01T14:00:00Z'),
    status: 'live', tossText: null, resultText: null, tournamentId: 't-1',
    tournament: { id: 't-1', name: 'Series', format: 'T20' },
    homeTeam: { id: 'a', name: 'India', shortCode: 'IND', country: 'India', logoUrl: null },
    awayTeam: { id: 'b', name: 'Australia', shortCode: 'AUS', country: 'Australia', logoUrl: null },
    venue: { name: 'Stadium', city: 'Mohali' },
    liveScore: null,
  };

  it('gives upcoming matches no scores', () => {
    expect(toMatchSummary(base).scores).toEqual([]);
  });

  it('summarises innings as short scores', () => {
    const s = toMatchSummary({
      ...base,
      liveScore: {
        matchId: 'm-1', updatedAt: new Date(), currentBatters: [], currentBowler: null, lastSixBalls: [], commentary: [],
        innings: [{ battingTeamId: 'a', runs: 180, wickets: 6, overs: '20.0', batting: [], bowling: [] }],
      },
    });
    expect(s.scores).toEqual([{ teamId: 'a', runs: 180, wickets: 6, overs: '20.0' }]);
    expect(s.startTimeUtc).toBe('2026-10-01T14:00:00.000Z');
  });
});
