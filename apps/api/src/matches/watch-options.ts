import type { BroadcasterType, WatchOptionDto } from '@cmf/shared';

export interface RightRow {
  matchId: string | null;
  language: string;
  isFree: boolean;
  broadcaster: {
    id: string;
    name: string;
    type: BroadcasterType;
    logoUrl: string | null;
    appDeeplinkTemplate: string | null;
    webUrlTemplate: string | null;
    affiliateUrl: string | null;
    isActive: boolean;
  };
}

export function fillTemplate(template: string | null, vars: Record<string, string>): string | null {
  if (!template) return null;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? encodeURIComponent(vars[key]) : whole));
}

/**
 * Turns the rights rows for one match + region into "Watch on" options.
 *
 * Rules:
 * - If any rows target this match specifically, they REPLACE the
 *   tournament-level rows (match-level override).
 * - One option per broadcaster + language; inactive broadcasters are hidden.
 * - Order: the viewer's subscriptions first, then free, then by name, then language.
 */
export function buildWatchOptions(
  rights: RightRow[],
  match: { id: string; providerMatchId: string },
  subscribedBroadcasterIds: string[],
): WatchOptionDto[] {
  const matchLevel = rights.filter((r) => r.matchId === match.id);
  const chosen = matchLevel.length > 0 ? matchLevel : rights.filter((r) => r.matchId === null);
  const subscribed = new Set(subscribedBroadcasterIds);
  const vars = { matchId: match.id, providerMatchId: match.providerMatchId };

  const seen = new Set<string>();
  const options: WatchOptionDto[] = [];
  for (const r of chosen) {
    const b = r.broadcaster;
    const key = `${b.id}:${r.language}`;
    if (!b.isActive || seen.has(key)) continue;
    seen.add(key);
    options.push({
      broadcasterId: b.id,
      name: b.name,
      type: b.type,
      logoUrl: b.logoUrl,
      language: r.language,
      isFree: r.isFree,
      isSubscribed: subscribed.has(b.id),
      deepLink: fillTemplate(b.appDeeplinkTemplate, vars),
      webUrl: fillTemplate(b.webUrlTemplate, vars),
      affiliateUrl: b.affiliateUrl,
    });
  }

  return options.sort(
    (a, b) =>
      Number(b.isSubscribed) - Number(a.isSubscribed) ||
      Number(b.isFree) - Number(a.isFree) ||
      a.name.localeCompare(b.name) ||
      a.language.localeCompare(b.language),
  );
}
