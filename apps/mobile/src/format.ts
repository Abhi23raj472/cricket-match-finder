import { DEFAULT_TIMEZONE, type InningsDto, type MatchSummaryDto, type ShortScore, type TeamDto } from '@cmf/shared';

/** The phone's time zone, or Asia/Kolkata if it can't be read. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

const dayKey = (d: Date, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** "Today", "Tomorrow", "Yesterday" or "Sat 3 Oct". */
export function formatDay(iso: string, tz = deviceTimeZone(), now = new Date()): string {
  const d = new Date(iso);
  const DAY = 86_400_000;
  const k = dayKey(d, tz);
  if (k === dayKey(now, tz)) return 'Today';
  if (k === dayKey(new Date(now.getTime() + DAY), tz)) return 'Tomorrow';
  if (k === dayKey(new Date(now.getTime() - DAY), tz)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(d);
}

/** "7:30 pm" */
export function formatTime(iso: string, tz = deviceTimeZone()): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)).toLowerCase();
}

/** "Today, 7:30 pm" */
export const formatWhen = (iso: string, tz = deviceTimeZone(), now = new Date()) => `${formatDay(iso, tz, now)}, ${formatTime(iso, tz)}`;

/** "186/5 (20.0)"; all out shows just runs. */
export function scoreText(s: Pick<ShortScore, 'runs' | 'wickets' | 'overs'>): string {
  const total = s.wickets >= 10 ? `${s.runs}` : `${s.runs}/${s.wickets}`;
  return `${total} (${s.overs})`;
}

/** Latest score for a team in a match, or null if it hasn't batted. */
export function teamScore(match: Pick<MatchSummaryDto, 'scores'>, team: TeamDto): ShortScore | null {
  const all = match.scores.filter((s) => s.teamId === team.id);
  return all.at(-1) ?? null;
}

/** e.g. "India need 42 runs from 30 balls" while chasing, else null. */
export function chaseText(innings: InningsDto[], teamName: (id: string) => string, quotaOvers = 20): string | null {
  if (innings.length !== 2) return null;
  const [first, second] = innings;
  const need = first.runs + 1 - second.runs;
  const [o, b = '0'] = second.overs.split('.');
  const ballsLeft = quotaOvers * 6 - (Number(o) * 6 + Number(b));
  if (need <= 0 || ballsLeft <= 0 || second.wickets >= 10) return null;
  return `${teamName(second.battingTeamId)} need ${need} run${need === 1 ? '' : 's'} from ${ballsLeft} ball${ballsLeft === 1 ? '' : 's'}`;
}

export const strikeRate = (runs: number, balls: number) => (balls ? ((runs / balls) * 100).toFixed(1) : '-');
export function economy(runs: number, overs: string) {
  const [o, b = '0'] = overs.split('.');
  const balls = Number(o) * 6 + Number(b);
  return balls ? ((runs / balls) * 6).toFixed(2) : '-';
}
