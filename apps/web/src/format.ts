import { DEFAULT_TIMEZONE } from '@cmf/shared';

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

const dayKey = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** "Today", "Tomorrow", "Yesterday" or "Saturday, 3 October". */
export function dayLabel(iso: string, tz = browserTimeZone(), now = new Date()): string {
  const d = new Date(iso);
  const DAY = 86_400_000;
  const k = dayKey(d, tz);
  if (k === dayKey(now, tz)) return 'Today';
  if (k === dayKey(new Date(now.getTime() + DAY), tz)) return 'Tomorrow';
  if (k === dayKey(new Date(now.getTime() - DAY), tz)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}

/** "7:30 pm" */
export const timeLabel = (iso: string, tz = browserTimeZone()) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)).toLowerCase();

/** "3 Oct" (UTC calendar date, for tournament dates stored as YYYY-MM-DD). */
export const shortDate = (ymd: string) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(ymd));

/** Groups items by dayLabel, keeping order. */
export function groupByDay<T>(items: T[], iso: (x: T) => string, tz = browserTimeZone(), now = new Date()): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const label = dayLabel(iso(it), tz, now);
    groups.set(label, [...(groups.get(label) ?? []), it]);
  }
  return [...groups.entries()];
}

/** Short human zone name for footers, e.g. "IST". */
export function zoneAbbrev(tz = browserTimeZone()): string {
  try {
    const part = new Intl.DateTimeFormat('en-IN', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName');
    return part?.value ?? tz;
  } catch {
    return tz;
  }
}

/** "Today", "Yesterday", "Tomorrow" or "28 Sep" — for compact rows. */
export function shortDayLabel(iso: string, tz = browserTimeZone(), now = new Date()): string {
  const full = dayLabel(iso, tz, now);
  if (full === 'Today' || full === 'Yesterday' || full === 'Tomorrow') return full;
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, day: 'numeric', month: 'short' }).format(new Date(iso));
}
