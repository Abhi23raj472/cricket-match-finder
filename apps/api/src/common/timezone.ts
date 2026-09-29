/** Time-zone helpers built on Intl (no extra dependency). */

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Offset of `tz` from UTC at instant `at`, in milliseconds (IST = +19800000). */
export function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * UTC range [start, end) covering calendar day `date` (YYYY-MM-DD) in `tz`.
 * e.g. 2026-10-01 in Asia/Kolkata -> 2026-09-30T18:30Z .. 2026-10-01T18:30Z
 */
export function zonedDayRange(date: string, tz: string): { start: Date; end: Date } {
  const [y, m, d] = date.split('-').map(Number);
  const localMidnight = (day: number) => {
    const guess = Date.UTC(y, m - 1, day);
    // Re-evaluate the offset at the corrected instant to handle DST changes.
    const first = guess - tzOffsetMs(new Date(guess), tz);
    return new Date(guess - tzOffsetMs(new Date(first), tz));
  };
  return { start: localMidnight(d), end: localMidnight(d + 1) };
}
