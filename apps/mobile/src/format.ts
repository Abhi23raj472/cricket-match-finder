import { DEFAULT_TIMEZONE } from '@cmf/shared';

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

export { scoreText, teamScore, chaseText, strikeRate, economy } from '@cmf/shared';
