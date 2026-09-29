import type { RightsGapDto } from '@cmf/shared';
import { buildWatchOptions, type RightRow } from '../matches/watch-options';

export interface GapMatch {
  id: string;
  providerMatchId: string;
  tournamentId: string;
  tournamentName: string;
  startTimeUtc: Date;
  label: string;
}

export interface GapRight extends RightRow {
  tournamentId: string;
  regionCode: string;
  validFrom: Date;
  validTo: Date;
}

/**
 * Matches that would show NO "Watch on" option in a region.
 * Uses the same buildWatchOptions() as GET /matches/:id, so the check can't
 * drift from what users actually see (override rules, inactive broadcasters).
 */
export function findRightsGaps(matches: GapMatch[], rights: GapRight[], regions: string[]): RightsGapDto[] {
  const gaps: RightsGapDto[] = [];
  for (const m of matches) {
    for (const region of regions) {
      const applicable = rights.filter(
        (r) =>
          r.tournamentId === m.tournamentId &&
          r.regionCode === region &&
          (r.matchId === null || r.matchId === m.id) &&
          r.validFrom <= m.startTimeUtc &&
          r.validTo >= m.startTimeUtc,
      );
      if (buildWatchOptions(applicable, m, []).length === 0) {
        gaps.push({
          match: { id: m.id, label: m.label, startTimeUtc: m.startTimeUtc.toISOString(), tournamentName: m.tournamentName },
          regionCode: region,
        });
      }
    }
  }
  return gaps;
}

export function matchLabel(m: { homeTeam: { shortCode: string }; awayTeam: { shortCode: string }; matchNo: string | null }) {
  return `${m.homeTeam.shortCode} v ${m.awayTeam.shortCode}${m.matchNo ? ` · ${m.matchNo}` : ''}`;
}
