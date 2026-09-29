/**
 * SAMPLE data shared by the mock provider and the database seed (made-up tournaments, fixtures, scores and rights).
 * Dates are relative to when the seed runs, so the 2 live matches stay live.
 */
import type { BroadcasterType as TBroadcasterType, MatchFormat as TMatchFormat, MatchStatus as TMatchStatus } from '@cmf/shared';

// String-literal enums so this file doesn't depend on the generated Prisma client.
const MatchStatus = { upcoming: 'upcoming', live: 'live', completed: 'completed', abandoned: 'abandoned' } as const satisfies Record<TMatchStatus, TMatchStatus>;
const MatchFormat = { T20: 'T20' } as const satisfies Partial<Record<TMatchFormat, TMatchFormat>>;
const BroadcasterType = { OTT: 'OTT', TV: 'TV', FREE: 'FREE' } as const satisfies Record<TBroadcasterType, TBroadcasterType>;
export { MatchStatus as MockStatus };

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
export const now = Date.now();
export const at = (offsetMs: number) => new Date(now + offsetMs);
export const dateOnly = (d: Date) => new Date(d.toISOString().slice(0, 10));

// ---------- Teams (8) ----------

export const teams = [
  // International (T20 Quad Series)
  { key: 'ind', name: 'India', shortCode: 'IND', country: 'India' },
  { key: 'aus', name: 'Australia', shortCode: 'AUS', country: 'Australia' },
  { key: 'eng', name: 'England', shortCode: 'ENG', country: 'England' },
  { key: 'rsa', name: 'South Africa', shortCode: 'RSA', country: 'South Africa' },
  // Domestic (T20 Trophy)
  { key: 'pun', name: 'Punjab', shortCode: 'PUN', country: 'India' },
  { key: 'mum', name: 'Mumbai', shortCode: 'MUM', country: 'India' },
  { key: 'del', name: 'Delhi', shortCode: 'DEL', country: 'India' },
  { key: 'kar', name: 'Karnataka', shortCode: 'KAR', country: 'India' },
] as const;
export type TeamKey = (typeof teams)[number]['key'];

// ---------- Venues ----------

export const venues = [
  { key: 'mohali', name: 'IS Bindra Stadium', city: 'Mohali', country: 'India', timezone: 'Asia/Kolkata' },
  { key: 'wankhede', name: 'Wankhede Stadium', city: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata' },
  { key: 'eden', name: 'Eden Gardens', city: 'Kolkata', country: 'India', timezone: 'Asia/Kolkata' },
  { key: 'delhi', name: 'Arun Jaitley Stadium', city: 'Delhi', country: 'India', timezone: 'Asia/Kolkata' },
  { key: 'blr', name: 'M. Chinnaswamy Stadium', city: 'Bengaluru', country: 'India', timezone: 'Asia/Kolkata' },
] as const;
export type VenueKey = (typeof venues)[number]['key'];

// ---------- Tournaments (2) ----------

export const tournaments = [
  {
    key: 'quad',
    name: 'T20 Quad Series 2026 (sample)',
    format: MatchFormat.T20,
    season: '2026',
    startDate: dateOnly(at(-4 * DAY)),
    endDate: dateOnly(at(6 * DAY)),
  },
  {
    key: 'trophy',
    name: 'Domestic T20 Trophy 2026 (sample)',
    format: MatchFormat.T20,
    season: '2026-27',
    startDate: dateOnly(at(-3 * DAY)),
    endDate: dateOnly(at(8 * DAY)),
  },
] as const;
export type TournamentKey = (typeof tournaments)[number]['key'];

// ---------- Scorecard helpers ----------

export function innings(battingTeamKey: TeamKey, runs: number, wickets: number, overs: string, top: [string, number, number][], bowl: [string, string, number, number][]) {
  return {
    battingTeamKey,
    runs,
    wickets,
    overs,
    batting: top.map(([name, r, b], i) => ({
      name,
      runs: r,
      balls: b,
      fours: Math.floor(r / 12),
      sixes: Math.floor(r / 25),
      dismissal: i < wickets ? 'c & b (sample)' : null,
    })),
    bowling: bowl.map(([name, o, r, w]) => ({ name, overs: o, maidens: 0, runs: r, wickets: w })),
  };
}
export type SeedInnings = ReturnType<typeof innings>;

// ---------- Matches (10: 3 completed, 2 live, 5 upcoming) ----------

export interface SeedMatch {
  key: string;
  tournament: TournamentKey;
  home: TeamKey;
  away: TeamKey;
  venue: VenueKey;
  matchNo: string;
  start: Date;
  status: TMatchStatus;
  toss?: string;
  result?: string;
  innings?: SeedInnings[];
  lastSix?: string[];
  commentary?: { over: string; text: string }[];
}

export const matches: SeedMatch[] = [
  // --- Quad series ---
  {
    key: 'quad-1', tournament: 'quad', home: 'ind', away: 'aus', venue: 'mohali', matchNo: '1st T20',
    start: at(-4 * DAY), status: MatchStatus.completed,
    toss: 'Australia won the toss and chose to bowl',
    result: 'India won by 18 runs',
    innings: [
      innings('ind', 186, 5, '20.0', [['Batter A', 64, 41], ['Batter B', 48, 33]], [['Bowler X', '4.0', 32, 2]]),
      innings('aus', 168, 8, '20.0', [['Batter C', 52, 38], ['Batter D', 37, 29]], [['Bowler Y', '4.0', 27, 3]]),
    ],
  },
  {
    key: 'quad-2', tournament: 'quad', home: 'eng', away: 'rsa', venue: 'eden', matchNo: '2nd T20',
    start: at(-3 * DAY), status: MatchStatus.completed,
    toss: 'England won the toss and chose to bat',
    result: 'South Africa won by 6 wickets',
    innings: [
      innings('eng', 159, 7, '20.0', [['Batter E', 55, 40]], [['Bowler Z', '4.0', 25, 3]]),
      innings('rsa', 163, 4, '18.3', [['Batter F', 71, 46]], [['Bowler W', '4.0', 30, 2]]),
    ],
  },
  {
    key: 'quad-3', tournament: 'quad', home: 'ind', away: 'eng', venue: 'wankhede', matchNo: '3rd T20',
    start: at(-90 * 60 * 1000), status: MatchStatus.live, // started 90 min ago
    toss: 'India won the toss and chose to bat',
    innings: [
      innings('ind', 201, 4, '20.0', [['Batter A', 88, 52], ['Batter G', 45, 27]], [['Bowler V', '4.0', 41, 2]]),
      innings('eng', 97, 3, '11.2', [['Batter E', 41, 28], ['Batter H', 22, 15]], [['Bowler X', '2.2', 19, 1]]),
    ],
    lastSix: ['1', '4', 'W', '0', '6', '1'],
    commentary: [
      { over: '11.2', text: 'Full on middle, driven to long-on for a single.' },
      { over: '11.1', text: 'Short and wide, cut hard for SIX over point!' },
      { over: '10.6', text: 'Dot ball. Good length, defended back to the bowler.' },
    ],
  },
  { key: 'quad-4', tournament: 'quad', home: 'aus', away: 'rsa', venue: 'delhi', matchNo: '4th T20', start: at(1 * DAY + 2 * HOUR), status: MatchStatus.upcoming },
  { key: 'quad-5', tournament: 'quad', home: 'ind', away: 'rsa', venue: 'mohali', matchNo: 'Final', start: at(5 * DAY + 3 * HOUR), status: MatchStatus.upcoming },

  // --- Domestic trophy ---
  {
    key: 'trophy-1', tournament: 'trophy', home: 'pun', away: 'mum', venue: 'mohali', matchNo: 'Match 1',
    start: at(-2 * DAY), status: MatchStatus.completed,
    toss: 'Mumbai won the toss and chose to bowl',
    result: 'Punjab won by 7 wickets',
    innings: [
      innings('mum', 148, 9, '20.0', [['Batter I', 44, 36]], [['Bowler U', '4.0', 22, 3]]),
      innings('pun', 152, 3, '17.4', [['Batter J', 67, 44]], [['Bowler T', '3.4', 31, 1]]),
    ],
  },
  {
    key: 'trophy-2', tournament: 'trophy', home: 'del', away: 'kar', venue: 'delhi', matchNo: 'Match 2',
    start: at(-40 * 60 * 1000), status: MatchStatus.live, // started 40 min ago
    toss: 'Karnataka won the toss and chose to bowl',
    innings: [innings('del', 78, 2, '9.1', [['Batter K', 39, 25], ['Batter L', 24, 18]], [['Bowler S', '2.1', 17, 1]])],
    lastSix: ['0', '1', '1', '4', '2', '1'],
    commentary: [
      { over: '9.1', text: 'Worked off the pads for a single.' },
      { over: '8.6', text: 'Driven through the covers for two.' },
    ],
  },
  { key: 'trophy-3', tournament: 'trophy', home: 'mum', away: 'kar', venue: 'wankhede', matchNo: 'Match 3', start: at(1 * DAY + 6 * HOUR), status: MatchStatus.upcoming },
  { key: 'trophy-4', tournament: 'trophy', home: 'pun', away: 'del', venue: 'mohali', matchNo: 'Match 4', start: at(3 * DAY + 6 * HOUR), status: MatchStatus.upcoming },
  { key: 'trophy-5', tournament: 'trophy', home: 'kar', away: 'pun', venue: 'blr', matchNo: 'Match 5', start: at(6 * DAY + 6 * HOUR), status: MatchStatus.upcoming },
];

// ---------- Broadcasters (4) ----------
// Link templates are placeholders. Verify each broadcaster's real deep-link
// format and linking terms before launch. Supported placeholders:
// {providerMatchId}, {matchId}

export const broadcasters = [
  { name: 'JioHotstar', type: BroadcasterType.OTT, appDeeplinkTemplate: null, webUrlTemplate: 'https://www.hotstar.com/in/sports/cricket' },
  { name: 'SonyLIV', type: BroadcasterType.OTT, appDeeplinkTemplate: null, webUrlTemplate: 'https://www.sonyliv.com/sports' },
  { name: 'FanCode', type: BroadcasterType.OTT, appDeeplinkTemplate: null, webUrlTemplate: 'https://www.fancode.com/cricket' },
  { name: 'DD Sports', type: BroadcasterType.FREE, appDeeplinkTemplate: null, webUrlTemplate: null },
] as const;
export type BroadcasterName = (typeof broadcasters)[number]['name'];

// ---------- Rights for region IN (sample) ----------

export interface SeedRight {
  broadcaster: BroadcasterName;
  tournament: TournamentKey;
  matchKey?: string; // set = single-match override
  language: string;
  isFree: boolean;
}

export const rightsIN: SeedRight[] = [
  { broadcaster: 'JioHotstar', tournament: 'quad', language: 'en', isFree: false },
  { broadcaster: 'JioHotstar', tournament: 'quad', language: 'hi', isFree: false },
  { broadcaster: 'DD Sports', tournament: 'quad', language: 'hi', isFree: true },
  { broadcaster: 'FanCode', tournament: 'trophy', language: 'en', isFree: false },
  // Match-level override: Punjab v Delhi is on SonyLIV INSTEAD of FanCode
  // (match-level rows replace the tournament-level rows for that match)
  { broadcaster: 'SonyLIV', tournament: 'trophy', matchKey: 'trophy-4', language: 'en', isFree: false },
];

