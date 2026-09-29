import { chaseText, economy, formatDay, formatTime, scoreText, strikeRate, teamScore } from '../format';

const IST = 'Asia/Kolkata';
const now = new Date('2026-10-01T06:30:00Z'); // 12:00 IST

describe('formatDay / formatTime', () => {
  it('uses Today / Tomorrow / Yesterday in the given time zone', () => {
    expect(formatDay('2026-10-01T15:00:00Z', IST, now)).toBe('Today');
    expect(formatDay('2026-10-01T19:00:00Z', IST, now)).toBe('Tomorrow'); // 00:30 IST on 2 Oct
    expect(formatDay('2026-09-30T10:00:00Z', IST, now)).toBe('Yesterday');
    expect(formatDay('2026-10-05T10:00:00Z', IST, now)).toMatch(/Mon.*5.*Oct/);
  });

  it('formats times in 12-hour IST', () => {
    expect(formatTime('2026-10-01T14:00:00Z', IST)).toBe('7:30 pm');
  });
});

describe('scores', () => {
  it('writes scores like 186/5 (20.0), and just runs when all out', () => {
    expect(scoreText({ runs: 186, wickets: 5, overs: '20.0' })).toBe('186/5 (20.0)');
    expect(scoreText({ runs: 120, wickets: 10, overs: '17.3' })).toBe('120 (17.3)');
  });

  it('picks the latest score for a team', () => {
    const m = { scores: [{ teamId: 'a', runs: 100, wickets: 2, overs: '12.0' }, { teamId: 'b', runs: 20, wickets: 0, overs: '2.0' }] };
    expect(teamScore(m, { id: 'b', name: 'B', shortCode: 'B' })?.runs).toBe(20);
    expect(teamScore(m, { id: 'c', name: 'C', shortCode: 'C' })).toBeNull();
  });

  it('describes a chase', () => {
    const inn = (id: string, runs: number, wickets: number, overs: string) => ({ battingTeamId: id, runs, wickets, overs, batting: [], bowling: [] });
    const name = (id: string) => (id === 'b' ? 'Australia' : 'India');
    expect(chaseText([inn('a', 180, 5, '20.0'), inn('b', 140, 4, '15.0')], name)).toBe('Australia need 41 runs from 30 balls');
    expect(chaseText([inn('a', 180, 5, '20.0'), inn('b', 180, 4, '19.5')], name)).toBe('Australia need 1 run from 1 ball');
    expect(chaseText([inn('a', 180, 5, '20.0')], name)).toBeNull();
    expect(chaseText([inn('a', 180, 5, '20.0'), inn('b', 181, 4, '19.0')], name)).toBeNull(); // already won
  });

  it('computes strike rate and economy', () => {
    expect(strikeRate(50, 25)).toBe('200.0');
    expect(strikeRate(0, 0)).toBe('-');
    expect(economy(30, '4.0')).toBe('7.50');
    expect(economy(10, '1.3')).toBe('6.67');
  });
});
