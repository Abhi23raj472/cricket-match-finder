import { computeStandings, type StandingsMatch } from '../src/tournaments/standings';
import type { InningsDto, TeamDto } from '@cmf/shared';

const team = (id: string, name: string): TeamDto => ({ id, name, shortCode: id.toUpperCase() });
const A = team('a', 'Alpha'), B = team('b', 'Bravo'), C = team('c', 'Charlie');
const inn = (teamId: string, runs: number, wickets: number, overs: string): InningsDto => ({
  battingTeamId: teamId, runs, wickets, overs, batting: [], bowling: [],
});
const done = (home: string, away: string, innings: InningsDto[]): StandingsMatch => ({ status: 'completed', homeTeamId: home, awayTeamId: away, innings });

describe('computeStandings', () => {
  it('awards 2 for a win, 0 for a loss and ranks by points', () => {
    const rows = computeStandings([A, B], [done('a', 'b', [inn('a', 160, 5, '20.0'), inn('b', 150, 8, '20.0')])], 'T20');
    expect(rows.map((r) => [r.team.id, r.played, r.won, r.lost, r.points])).toEqual([
      ['a', 1, 1, 0, 2],
      ['b', 1, 0, 1, 0],
    ]);
  });

  it('awards 1 each for a tie and for an abandoned match', () => {
    const rows = computeStandings(
      [A, B],
      [
        done('a', 'b', [inn('a', 150, 5, '20.0'), inn('b', 150, 7, '20.0')]),
        { status: 'abandoned', homeTeamId: 'a', awayTeamId: 'b', innings: [] },
      ],
      'T20',
    );
    for (const r of rows) expect(r).toMatchObject({ played: 2, tied: 1, noResult: 1, points: 2 });
  });

  it('computes net run rate, counting a bowled-out side as facing 20 overs', () => {
    // A: 180 in 20 overs; B all out for 120 in 15.0 overs -> counts as 20 overs
    const rows = computeStandings([A, B], [done('a', 'b', [inn('a', 180, 6, '20.0'), inn('b', 120, 10, '15.0')])], 'T20');
    const a = rows.find((r) => r.team.id === 'a')!;
    const b = rows.find((r) => r.team.id === 'b')!;
    expect(a.netRunRate).toBe(3); // 180/20 - 120/20
    expect(b.netRunRate).toBe(-3);
  });

  it('uses partial overs for a successful chase', () => {
    // A 150/7 (20); B 151/2 in 15.3 overs (93 balls)
    const rows = computeStandings([A, B], [done('a', 'b', [inn('a', 150, 7, '20.0'), inn('b', 151, 2, '15.3')])], 'T20');
    const b = rows.find((r) => r.team.id === 'b')!;
    expect(b.won).toBe(1);
    expect(b.netRunRate).toBeCloseTo(151 / (93 / 6) - 150 / 20, 3);
  });

  it('breaks points ties by NRR and lists teams that have not played', () => {
    const rows = computeStandings(
      [A, B, C],
      [
        done('a', 'b', [inn('a', 200, 3, '20.0'), inn('b', 100, 10, '14.0')]),
        done('b', 'a', [inn('b', 150, 5, '20.0'), inn('a', 149, 9, '20.0')]),
      ],
      'T20',
    );
    expect(rows.map((r) => r.team.id)).toEqual(['a', 'b', 'c']); // equal points, A better NRR
    expect(rows[2]).toMatchObject({ played: 0, points: 0, netRunRate: 0 });
  });

  it('ignores live and upcoming matches', () => {
    const rows = computeStandings([A, B], [{ status: 'live', homeTeamId: 'a', awayTeamId: 'b', innings: [inn('a', 50, 1, '5.0')] }], 'T20');
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });
});
