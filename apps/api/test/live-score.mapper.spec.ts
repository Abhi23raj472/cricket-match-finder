import { mapLiveScore } from '../src/live/live-score.mapper';
import type { ProviderLiveScore } from '../src/provider/cricket-provider.interface';

const score: ProviderLiveScore = {
  providerMatchId: 'p-1',
  status: 'live',
  tossText: 'A won the toss',
  resultText: null,
  innings: [
    { battingProviderTeamId: 'pt-a', runs: 120, wickets: 3, overs: '14.2', batting: [{ name: 'X', runs: 50, balls: 30, fours: 5, sixes: 2 }], bowling: [] },
  ],
  currentBatters: [{ name: 'X', runs: 50, balls: 30, fours: 5, sixes: 2 }],
  currentBowler: { name: 'Y', overs: '3.2', maidens: 0, runs: 20, wickets: 1 },
  lastSixBalls: ['1', '4', '0', '0', 'W', '6'],
  commentary: [{ over: '14.2', text: 'SIX!' }],
};

describe('mapLiveScore', () => {
  it('converts provider team ids to our ids and fills defaults', () => {
    const now = new Date('2026-10-01T10:00:00Z');
    const { dto, match } = mapLiveScore('m-1', score, { 'pt-a': 'team-a', 'pt-b': 'team-b' }, now);
    expect(dto.matchId).toBe('m-1');
    expect(dto.innings[0].battingTeamId).toBe('team-a');
    expect(dto.innings[0].batting[0].dismissal).toBeNull();
    expect(dto.currentBatters[0].name).toBe('X');
    expect(dto.currentBowler?.name).toBe('Y');
    expect(dto.updatedAt).toBe(now.toISOString());
    expect(match).toEqual({ status: 'live', tossText: 'A won the toss', resultText: null });
  });

  it('throws when an innings belongs to a team not in the match', () => {
    expect(() => mapLiveScore('m-1', score, { 'pt-b': 'team-b' })).toThrow(/Unknown batting team/);
  });
});
