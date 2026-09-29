import type { InningsDto, LiveScoreDto, MatchStatus } from '@cmf/shared';
import type { ProviderLiveScore } from '../provider/cricket-provider.interface';

export interface MappedLiveScore {
  dto: LiveScoreDto;
  match: { status: MatchStatus; tossText: string | null; resultText: string | null };
}

/**
 * Converts a provider scorecard (provider team ids) into our DTO (our team ids).
 * teamIdByProviderId maps providerTeamId -> teams.id for the two sides.
 */
export function mapLiveScore(
  matchId: string,
  score: ProviderLiveScore,
  teamIdByProviderId: Record<string, string>,
  now: Date = new Date(),
): MappedLiveScore {
  const innings: InningsDto[] = score.innings.map((inn) => {
    const battingTeamId = teamIdByProviderId[inn.battingProviderTeamId];
    if (!battingTeamId) {
      throw new Error(`Unknown batting team "${inn.battingProviderTeamId}" for match ${matchId}`);
    }
    return {
      battingTeamId,
      runs: inn.runs,
      wickets: inn.wickets,
      overs: inn.overs,
      batting: inn.batting.map((b) => ({ ...b, dismissal: b.dismissal ?? null })),
      bowling: inn.bowling.map((b) => ({ ...b })),
    };
  });

  return {
    dto: {
      matchId,
      status: score.status,
      tossText: score.tossText ?? null,
      innings,
      currentBatters: score.currentBatters.map((b) => ({ ...b, dismissal: b.dismissal ?? null })),
      currentBowler: score.currentBowler ? { ...score.currentBowler } : null,
      lastSixBalls: [...score.lastSixBalls],
      commentary: score.commentary.map((c) => ({ ...c })),
      updatedAt: now.toISOString(),
    },
    match: {
      status: score.status,
      tossText: score.tossText ?? null,
      resultText: score.resultText ?? null,
    },
  };
}
