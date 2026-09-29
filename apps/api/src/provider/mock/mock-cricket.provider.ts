/**
 * Mock cricket data provider for local development and tests.
 *
 * - Fixtures come from mock-data.ts (the same data the DB seed uses).
 * - Live T20 matches are simulated: every getLiveScore() call bowls one ball,
 *   using a seeded random generator so a given match always plays out the
 *   same way. Innings switch at 20 overs / 10 wickets, and the match finishes
 *   with a proper result ("won by X runs", "won by X wickets", "Match tied").
 * - Upcoming matches go live (toss + first ball) once their start time passes.
 */
import type { MatchStatus } from '@cmf/shared';
import type {
  CricketDataProvider,
  ProviderBattingLine,
  ProviderBowlingLine,
  ProviderFixture,
  ProviderInnings,
  ProviderLiveScore,
  ProviderTeam,
  ProviderVenue,
  ProviderSeries,
} from '../cricket-provider.interface';
import { matches, teams, tournaments, venues, type SeedMatch, type TeamKey } from './mock-data';

const MAX_BALLS = 120; // T20
const MAX_WICKETS = 10;
const COMMENTARY_LIMIT = 30;

type Outcome = '0' | '1' | '2' | '3' | '4' | '6' | 'W' | 'wd';
// Rough T20 ball-outcome weights (sum = 100)
const OUTCOMES: [Outcome, number][] = [
  ['0', 34], ['1', 30], ['2', 8], ['3', 1], ['4', 12], ['6', 6], ['W', 6], ['wd', 3],
];

interface SimInnings {
  battingKey: TeamKey;
  bowlingKey: TeamKey;
  runs: number;
  wickets: number;
  balls: number; // legal deliveries
  batting: ProviderBattingLine[];
  strikerIdx: number;
  nonStrikerIdx: number;
  bowling: ProviderBowlingLine[];
  bowlerIdx: number;
  bowlerBalls: number[]; // legal balls per bowler
  nextBatterNo: number;
}

interface SimState {
  match: SeedMatch;
  status: MatchStatus;
  tossText: string | null;
  resultText: string | null;
  innings: SimInnings[];
  lastSix: string[];
  commentary: { over: string; text: string }[];
  step: number;
}

export interface MockProviderOptions {
  /** Clock, overridable in tests. */
  now?: () => number;
}

export class MockCricketProvider implements CricketDataProvider {
  readonly name = 'mock';
  private readonly now: () => number;
  private readonly sims = new Map<string, SimState>();

  constructor(opts: MockProviderOptions = {}) {
    this.now = opts.now ?? Date.now;
  }

  async listFixtures(from: Date, to: Date): Promise<ProviderFixture[]> {
    return matches
      .filter((m) => m.start.getTime() >= from.getTime() && m.start.getTime() <= to.getTime())
      .map((m) => {
        const sim = this.stateFor(m);
        return {
          providerMatchId: providerMatchId(m),
          series: series(m.tournament),
          homeTeam: team(m.home),
          awayTeam: team(m.away),
          venue: venue(m.venue),
          matchNo: m.matchNo,
          startTimeUtc: m.start.toISOString(),
          status: sim?.status ?? m.status,
          tossText: sim?.tossText ?? m.toss ?? null,
          resultText: sim?.resultText ?? m.result ?? null,
        };
      });
  }

  async getLiveScore(id: string): Promise<ProviderLiveScore | null> {
    const m = matches.find((x) => providerMatchId(x) === id);
    if (!m) return null;
    const sim = this.stateFor(m);
    if (!sim) return null; // not started yet
    if (sim.status === 'live') this.bowlBall(sim);
    return this.snapshot(sim);
  }

  // ---------- simulation ----------

  /** Returns the sim for a match, creating it once the match has started. */
  private stateFor(m: SeedMatch): SimState | null {
    const existing = this.sims.get(m.key);
    if (existing) return existing;

    if (m.status === 'upcoming' && m.start.getTime() > this.now()) return null;
    if (m.status === 'abandoned') return null;

    let sim: SimState;
    if (m.status === 'upcoming') {
      // Start time has passed: toss, home side bats first.
      sim = {
        match: m,
        status: 'live',
        tossText: `${team(m.away).name} won the toss and chose to bowl`,
        resultText: null,
        innings: [newInnings(m.home, m.away)],
        lastSix: [],
        commentary: [{ over: '0.0', text: 'Players are out in the middle. We are ready to go.' }],
        step: 0,
      };
    } else {
      sim = {
        match: m,
        status: m.status,
        tossText: m.toss ?? null,
        resultText: m.result ?? null,
        innings: (m.innings ?? []).map((inn, i, all) =>
          fromSeedInnings(
            inn.battingTeamKey,
            inn.battingTeamKey === m.home ? m.away : m.home,
            inn,
            // only the innings in progress needs two not-out batters at the crease
            m.status === 'live' && i === all.length - 1,
          ),
        ),
        lastSix: [...(m.lastSix ?? [])],
        commentary: [...(m.commentary ?? [])],
        step: 0,
      };
      if (sim.status === 'live' && sim.innings.length === 0) sim.innings.push(newInnings(m.home, m.away));
    }
    this.sims.set(m.key, sim);
    return sim;
  }

  private bowlBall(sim: SimState) {
    const inn = sim.innings[sim.innings.length - 1];
    const rand = mulberry32(hash(`${sim.match.key}:${sim.step++}`));
    const outcome = pick(rand());
    const overLabel = `${Math.floor(inn.balls / 6)}.${(inn.balls % 6) + 1}`;
    const striker = inn.batting[inn.strikerIdx];
    const bowler = inn.bowling[inn.bowlerIdx];

    let text: string;
    if (outcome === 'wd') {
      inn.runs += 1;
      bowler.runs += 1;
      text = `Wide, drifting down leg. ${bowler.name} to ${striker.name}.`;
    } else {
      inn.balls += 1;
      striker.balls += 1;
      inn.bowlerBalls[inn.bowlerIdx] += 1;
      bowler.overs = oversFromBalls(inn.bowlerBalls[inn.bowlerIdx]);

      if (outcome === 'W') {
        inn.wickets += 1;
        bowler.wickets += 1;
        striker.dismissal = `c Fielder b ${bowler.name}`;
        text = `OUT! ${striker.name} is caught off ${bowler.name}.`;
        if (inn.wickets < MAX_WICKETS) {
          inn.batting.push(batter(`${teamName(inn.battingKey)} Batter ${inn.nextBatterNo++}`));
          inn.strikerIdx = inn.batting.length - 1;
        }
      } else {
        const r = Number(outcome);
        inn.runs += r;
        striker.runs += r;
        bowler.runs += r;
        if (r === 4) striker.fours += 1;
        if (r === 6) striker.sixes += 1;
        text = commentaryFor(r, bowler.name, striker.name);
        if (r % 2 === 1) swapStrike(inn);
      }

      // End of over: swap strike, next bowler (rotating through 5).
      if (inn.balls % 6 === 0 && inn.balls < MAX_BALLS) {
        swapStrike(inn);
        inn.bowlerIdx = (inn.bowlerIdx + 1) % inn.bowling.length;
      }
    }

    sim.lastSix = [...sim.lastSix, outcome].slice(-6);
    sim.commentary = [{ over: overLabel, text }, ...sim.commentary].slice(0, COMMENTARY_LIMIT);
    this.checkInningsEnd(sim);
  }

  private checkInningsEnd(sim: SimState) {
    const inn = sim.innings[sim.innings.length - 1];
    const allOutOrOvers = inn.wickets >= MAX_WICKETS || inn.balls >= MAX_BALLS;

    if (sim.innings.length === 1) {
      if (allOutOrOvers) {
        sim.innings.push(newInnings(inn.bowlingKey, inn.battingKey));
        sim.commentary = [
          { over: '0.0', text: `Innings break. ${teamName(sim.innings[1].battingKey)} need ${inn.runs + 1} to win.` },
          ...sim.commentary,
        ].slice(0, COMMENTARY_LIMIT);
      }
      return;
    }

    const first = sim.innings[0];
    const chaseWon = inn.runs > first.runs;
    if (!chaseWon && !allOutOrOvers) return;

    sim.status = 'completed';
    if (chaseWon) {
      const w = MAX_WICKETS - inn.wickets;
      sim.resultText = `${teamName(inn.battingKey)} won by ${w} wicket${w === 1 ? '' : 's'}`;
    } else if (inn.runs === first.runs) {
      sim.resultText = 'Match tied';
    } else {
      const r = first.runs - inn.runs;
      sim.resultText = `${teamName(first.battingKey)} won by ${r} run${r === 1 ? '' : 's'}`;
    }
    sim.commentary = [{ over: oversFromBalls(inn.balls), text: sim.resultText }, ...sim.commentary].slice(0, COMMENTARY_LIMIT);
  }

  private snapshot(sim: SimState): ProviderLiveScore {
    const current = sim.status === 'live' ? sim.innings[sim.innings.length - 1] : null;
    return clone({
      providerMatchId: providerMatchId(sim.match),
      status: sim.status,
      tossText: sim.tossText,
      resultText: sim.resultText,
      innings: sim.innings.map(toProviderInnings),
      currentBatters: current
        ? [current.batting[current.strikerIdx], current.batting[current.nonStrikerIdx]].filter((b) => b && !b.dismissal)
        : [],
      currentBowler: current ? current.bowling[current.bowlerIdx] : null,
      lastSixBalls: sim.lastSix,
      commentary: sim.commentary,
    });
  }
}

// ---------- helpers ----------

export const providerMatchId = (m: SeedMatch) => `mock-match-${m.key}`;

function team(key: TeamKey): ProviderTeam {
  const t = teams.find((x) => x.key === key)!;
  return { providerTeamId: `mock-team-${t.key}`, name: t.name, shortCode: t.shortCode, country: t.country, logoUrl: null };
}
const teamName = (key: TeamKey) => team(key).name;

function venue(key: SeedMatch['venue']): ProviderVenue {
  const v = venues.find((x) => x.key === key)!;
  return { providerVenueId: `mock-venue-${v.key}`, name: v.name, city: v.city, country: v.country, timezone: v.timezone };
}

function series(key: SeedMatch['tournament']): ProviderSeries {
  const t = tournaments.find((x) => x.key === key)!;
  return {
    providerSeriesId: `mock-series-${t.key}`,
    name: t.name,
    format: t.format,
    season: t.season,
    startDate: t.startDate.toISOString().slice(0, 10),
    endDate: t.endDate.toISOString().slice(0, 10),
  };
}

const batter = (name: string): ProviderBattingLine => ({ name, runs: 0, balls: 0, fours: 0, sixes: 0, dismissal: null });

function bowlersFor(key: TeamKey): ProviderBowlingLine[] {
  return [1, 2, 3, 4, 5].map((n) => ({ name: `${teamName(key)} Bowler ${n}`, overs: '0.0', maidens: 0, runs: 0, wickets: 0 }));
}

function newInnings(battingKey: TeamKey, bowlingKey: TeamKey): SimInnings {
  const name = teamName(battingKey);
  return {
    battingKey,
    bowlingKey,
    runs: 0,
    wickets: 0,
    balls: 0,
    batting: [batter(`${name} Batter 1`), batter(`${name} Batter 2`)],
    strikerIdx: 0,
    nonStrikerIdx: 1,
    bowling: bowlersFor(bowlingKey),
    bowlerIdx: 0,
    bowlerBalls: [0, 0, 0, 0, 0],
    nextBatterNo: 3,
  };
}

/** Turns a static seed innings into a simulatable one (adds not-out batters if needed). */
function fromSeedInnings(
  battingKey: TeamKey,
  bowlingKey: TeamKey,
  seed: NonNullable<SeedMatch['innings']>[number],
  inProgress: boolean,
): SimInnings {
  const balls = ballsFromOvers(seed.overs);
  const batting: ProviderBattingLine[] = seed.batting.map((b) => ({ ...b }));
  let nextBatterNo = batting.length + 1;
  while (inProgress && batting.filter((b) => !b.dismissal).length < 2) {
    batting.push(batter(`${teamName(battingKey)} Batter ${nextBatterNo++}`));
  }
  const notOut = batting.map((b, i) => (b.dismissal ? -1 : i)).filter((i) => i >= 0);

  // Use the seed bowler as bowler 1, then generic ones.
  const bowling = bowlersFor(bowlingKey);
  const bowlerBalls = [0, 0, 0, 0, 0];
  if (seed.bowling[0]) {
    bowling[0] = { ...seed.bowling[0] };
    bowlerBalls[0] = ballsFromOvers(seed.bowling[0].overs);
  }

  return {
    battingKey,
    bowlingKey,
    runs: seed.runs,
    wickets: seed.wickets,
    balls,
    batting,
    strikerIdx: notOut[0] ?? 0,
    nonStrikerIdx: notOut[1] ?? 0,
    bowling,
    bowlerIdx: 0,
    bowlerBalls,
    nextBatterNo,
  };
}

function toProviderInnings(inn: SimInnings): ProviderInnings {
  return {
    battingProviderTeamId: `mock-team-${inn.battingKey}`,
    runs: inn.runs,
    wickets: inn.wickets,
    overs: oversFromBalls(inn.balls),
    batting: inn.batting,
    bowling: inn.bowling.filter((b, i) => inn.bowlerBalls[i] > 0 || b.runs > 0),
  };
}

function swapStrike(inn: SimInnings) {
  [inn.strikerIdx, inn.nonStrikerIdx] = [inn.nonStrikerIdx, inn.strikerIdx];
}

export const oversFromBalls = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;
export function ballsFromOvers(overs: string): number {
  const [o, b = '0'] = overs.split('.');
  return Number(o) * 6 + Number(b);
}

function commentaryFor(runs: number, bowler: string, batter: string): string {
  switch (runs) {
    case 0: return `${bowler} to ${batter}, no run. Defended back down the pitch.`;
    case 1: return `${bowler} to ${batter}, 1 run. Worked into the gap for a single.`;
    case 2: return `${bowler} to ${batter}, 2 runs. Pushed into the deep, they come back for two.`;
    case 3: return `${bowler} to ${batter}, 3 runs. Chased down just inside the rope.`;
    case 4: return `${bowler} to ${batter}, FOUR! Driven through the covers.`;
    case 6: return `${bowler} to ${batter}, SIX! Launched over long-on.`;
    default: return `${bowler} to ${batter}, ${runs} runs.`;
  }
}

function pick(r: number): Outcome {
  let acc = 0;
  const x = r * 100;
  for (const [o, w] of OUTCOMES) {
    acc += w;
    if (x < acc) return o;
  }
  return '0';
}

/** Small, fast seeded PRNG so simulations are repeatable. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
