/**
 * Contract every cricket data provider must implement.
 *
 * Providers speak in THEIR ids (providerTeamId, providerMatchId, ...). The sync
 * and poller services map those ids to our database ids, so swapping the mock
 * for a licensed API (Sportradar, Roanuz, EntitySport, ...) means writing one
 * new class that implements this interface — nothing else changes.
 */
import type { MatchFormat, MatchStatus } from '@cmf/shared';

export const CRICKET_PROVIDER = Symbol('CRICKET_PROVIDER');

export interface ProviderTeam {
  providerTeamId: string;
  name: string;
  shortCode: string;
  country?: string | null;
  logoUrl?: string | null;
}

export interface ProviderVenue {
  providerVenueId: string;
  name: string;
  city: string;
  country: string;
  timezone: string; // IANA
}

export interface ProviderSeries {
  providerSeriesId: string;
  name: string;
  format: MatchFormat;
  season: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface ProviderFixture {
  providerMatchId: string;
  series: ProviderSeries;
  homeTeam: ProviderTeam;
  awayTeam: ProviderTeam;
  venue: ProviderVenue;
  matchNo?: string | null;
  startTimeUtc: string; // ISO datetime
  status: MatchStatus;
  tossText?: string | null;
  resultText?: string | null;
}

export interface ProviderBattingLine {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissal?: string | null;
}

export interface ProviderBowlingLine {
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
}

export interface ProviderInnings {
  battingProviderTeamId: string;
  runs: number;
  wickets: number;
  overs: string; // "18.4"
  batting: ProviderBattingLine[];
  bowling: ProviderBowlingLine[];
}

export interface ProviderLiveScore {
  providerMatchId: string;
  status: MatchStatus;
  tossText?: string | null;
  resultText?: string | null;
  innings: ProviderInnings[];
  currentBatters: ProviderBattingLine[];
  currentBowler?: ProviderBowlingLine | null;
  lastSixBalls: string[];
  commentary: { over: string; text: string }[]; // newest first
}

export interface CricketDataProvider {
  readonly name: string;
  /** Fixtures whose start time falls in [from, to]. */
  listFixtures(from: Date, to: Date): Promise<ProviderFixture[]>;
  /** Latest scorecard, or null if the provider has none (e.g. not started). */
  getLiveScore(providerMatchId: string): Promise<ProviderLiveScore | null>;
}
