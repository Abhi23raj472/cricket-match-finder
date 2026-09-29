import { MockCricketProvider, ballsFromOvers } from '../src/provider/mock/mock-cricket.provider';
import { matches } from '../src/provider/mock/mock-data';

const DAY = 24 * 60 * 60 * 1000;
const liveKey = matches.find((m) => m.status === 'live')!.key;
const liveId = `mock-match-${liveKey}`;
const upcoming = matches.find((m) => m.status === 'upcoming')!;
const completed = matches.find((m) => m.status === 'completed')!;

const totalBalls = (s: { innings: { overs: string }[] }) => s.innings.reduce((n, i) => n + ballsFromOvers(i.overs), 0);
const totalRuns = (s: { innings: { runs: number }[] }) => s.innings.reduce((n, i) => n + i.runs, 0);

describe('MockCricketProvider', () => {
  it('lists fixtures inside the requested window', async () => {
    const p = new MockCricketProvider();
    const all = await p.listFixtures(new Date(Date.now() - 30 * DAY), new Date(Date.now() + 30 * DAY));
    expect(all).toHaveLength(10);
    const next2Days = await p.listFixtures(new Date(), new Date(Date.now() + 2 * DAY));
    expect(next2Days.every((f) => new Date(f.startTimeUtc).getTime() >= Date.now() - 1000)).toBe(true);
    expect(next2Days.length).toBeLessThan(10);
  });

  it('bowls exactly one delivery per poll of a live match', async () => {
    const p = new MockCricketProvider();
    const a = (await p.getLiveScore(liveId))!;
    const b = (await p.getLiveScore(liveId))!;
    const ballDiff = totalBalls(b) - totalBalls(a);
    const runDiff = totalRuns(b) - totalRuns(a);
    // either a legal ball (+1 ball) or a wide (+1 run, no ball)
    expect(ballDiff === 1 || (ballDiff === 0 && runDiff === 1)).toBe(true);
    expect(b.lastSixBalls).toHaveLength(6);
    expect(b.commentary.length).toBeGreaterThan(a.commentary.length - 1);
  });

  it('is deterministic: two providers play the same match identically', async () => {
    const p1 = new MockCricketProvider();
    const p2 = new MockCricketProvider();
    let s1, s2;
    for (let i = 0; i < 25; i++) {
      s1 = await p1.getLiveScore(liveId);
      s2 = await p2.getLiveScore(liveId);
    }
    expect(s1).toEqual(s2);
  });

  it.each(matches.filter((m) => m.status === 'live').map((m) => m.key))(
    'plays live match %s through to a valid T20 result',
    async (key) => {
      const p = new MockCricketProvider();
      let s = (await p.getLiveScore(`mock-match-${key}`))!;
      for (let i = 0; i < 400 && s.status === 'live'; i++) {
        s = (await p.getLiveScore(`mock-match-${key}`))!;
        for (const inn of s.innings) {
          expect(ballsFromOvers(inn.overs)).toBeLessThanOrEqual(120);
          expect(inn.wickets).toBeLessThanOrEqual(10);
        }
        if (s.status === 'live') expect(s.currentBatters.length).toBeGreaterThan(0);
      }
      expect(s.status).toBe('completed');
      expect(s.innings).toHaveLength(2);
      expect(s.resultText).toMatch(/won by \d+ (run|wicket)s?$|^Match tied$/);
      expect(s.currentBatters).toEqual([]);

      // Winner in the text matches the scores
      const [first, second] = s.innings;
      if (second.runs > first.runs) expect(s.resultText).toMatch(/wickets?$/);
      if (second.runs < first.runs) expect(s.resultText).toMatch(/runs?$/);

      // Once finished, further polls change nothing
      const again = await p.getLiveScore(`mock-match-${key}`);
      expect(again).toEqual(s);
    },
  );

  it('returns nothing for an upcoming match until its start time, then goes live', async () => {
    let clock = Date.now();
    const p = new MockCricketProvider({ now: () => clock });
    const id = `mock-match-${upcoming.key}`;
    expect(await p.getLiveScore(id)).toBeNull();

    clock = upcoming.start.getTime() + 1000;
    const s = (await p.getLiveScore(id))!;
    expect(s.status).toBe('live');
    expect(s.tossText).toMatch(/won the toss/);
    expect(s.innings).toHaveLength(1);
  });

  it('returns a fixed scorecard for a completed match', async () => {
    const p = new MockCricketProvider();
    const id = `mock-match-${completed.key}`;
    const a = await p.getLiveScore(id);
    const b = await p.getLiveScore(id);
    expect(a!.status).toBe('completed');
    expect(a!.resultText).toBe(completed.result);
    expect(b).toEqual(a);
  });

  it('returns null for an unknown match', async () => {
    expect(await new MockCricketProvider().getLiveScore('nope')).toBeNull();
  });
});
