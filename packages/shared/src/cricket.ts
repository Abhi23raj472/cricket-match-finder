/** Pure cricket helpers shared by the website and the mobile app. */
import type { InningsDto, MatchSummaryDto, ShortScore, TeamDto, WatchOptionDto } from './index';

/** "186/5 (20.0)"; a side that is all out shows just the runs. */
export function scoreText(s: Pick<ShortScore, 'runs' | 'wickets' | 'overs'>): string {
  const total = s.wickets >= 10 ? `${s.runs}` : `${s.runs}/${s.wickets}`;
  return `${total} (${s.overs})`;
}

/** Latest score for a team in a match, or null if it hasn't batted. */
export function teamScore(match: Pick<MatchSummaryDto, 'scores'>, team: TeamDto | Pick<TeamDto, 'id'>): ShortScore | null {
  return match.scores.filter((s) => s.teamId === team.id).at(-1) ?? null;
}

export function oversToBalls(overs: string): number {
  const [o, b = '0'] = overs.split('.');
  return Number(o) * 6 + Number(b);
}

/** e.g. "India need 42 runs from 30 balls" during a chase, else null. */
export function chaseText(innings: InningsDto[], teamName: (id: string) => string, quotaOvers = 20): string | null {
  if (innings.length !== 2) return null;
  const [first, second] = innings;
  const need = first.runs + 1 - second.runs;
  const ballsLeft = quotaOvers * 6 - oversToBalls(second.overs);
  if (need <= 0 || ballsLeft <= 0 || second.wickets >= 10) return null;
  return `${teamName(second.battingTeamId)} need ${need} run${need === 1 ? '' : 's'} from ${ballsLeft} ball${ballsLeft === 1 ? '' : 's'}`;
}

/** Current run rate, e.g. "8.56". */
export function runRate(runs: number, overs: string): string {
  const balls = oversToBalls(overs);
  return balls ? ((runs / balls) * 6).toFixed(2) : '0.00';
}

export const strikeRate = (runs: number, balls: number) => (balls ? ((runs / balls) * 100).toFixed(1) : '-');

export function economy(runs: number, overs: string): string {
  const balls = oversToBalls(overs);
  return balls ? ((runs / balls) * 6).toFixed(2) : '-';
}

/** Marks the viewer's own subscriptions and orders: yours, free, then A–Z. */
export function sortWatchOptions(options: WatchOptionDto[], subscribed: string[] = []): WatchOptionDto[] {
  const mine = new Set(subscribed);
  return options
    .map((o) => ({ ...o, isSubscribed: o.isSubscribed || mine.has(o.broadcasterId) }))
    .sort(
      (a, b) =>
        Number(b.isSubscribed) - Number(a.isSubscribed) ||
        Number(b.isFree) - Number(a.isFree) ||
        a.name.localeCompare(b.name) ||
        a.language.localeCompare(b.language),
    );
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', bn: 'Bengali', mr: 'Marathi', ml: 'Malayalam',
};
export const languageName = (code: string) => LANGUAGE_NAMES[code] ?? code;

/** Countries the apps offer in their country pickers. */
export const REGIONS: { code: string; name: string }[] = [
  { code: 'IN', name: 'India' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SG', name: 'Singapore' },
];
