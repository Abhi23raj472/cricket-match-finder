// Shared API contracts used by api, admin and mobile.

export type MatchStatus = 'upcoming' | 'live' | 'completed' | 'abandoned';
export type MatchFormat = 'TEST' | 'ODI' | 'T20' | 'T10' | 'OTHER';
export type BroadcasterType = 'OTT' | 'TV' | 'FREE';
export type AlertEvent = 'toss' | 'start' | 'wicket' | 'milestone' | 'result';

export interface TeamDto {
  id: string;
  name: string;
  shortCode: string;
  country?: string | null;
  logoUrl?: string | null;
}

export interface TournamentDto {
  id: string;
  name: string;
  format: MatchFormat;
  season: string;
  startDate: string; // ISO date
  endDate: string;
}

export interface VenueDto {
  id: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
}

export interface ShortScore {
  teamId: string;
  runs: number;
  wickets: number;
  overs: string; // "18.4"
}

export interface MatchSummaryDto {
  id: string;
  tournament: Pick<TournamentDto, 'id' | 'name' | 'format'>;
  homeTeam: TeamDto;
  awayTeam: TeamDto;
  venue: Pick<VenueDto, 'name' | 'city'>;
  matchNo?: string | null;
  startTimeUtc: string; // ISO datetime
  status: MatchStatus;
  resultText?: string | null;
  scores: ShortScore[];
}

export interface WatchOptionDto {
  broadcasterId: string;
  name: string;
  type: BroadcasterType;
  logoUrl?: string | null;
  language: string;
  isFree: boolean;
  isSubscribed: boolean;
  deepLink?: string | null;
  webUrl?: string | null;
  affiliateUrl?: string | null;
}

export interface BattingLine {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissal?: string | null;
}

export interface BowlingLine {
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
}

export interface InningsDto {
  battingTeamId: string;
  runs: number;
  wickets: number;
  overs: string;
  batting: BattingLine[];
  bowling: BowlingLine[];
}

export interface LiveScoreDto {
  matchId: string;
  status: MatchStatus;
  tossText?: string | null;
  innings: InningsDto[];
  currentBatters: BattingLine[]; // at the crease, striker first
  currentBowler?: BowlingLine | null;
  lastSixBalls: string[]; // e.g. ["1","4","W","0","6","1"]
  commentary: { over: string; text: string }[];
  updatedAt: string;
}

export interface MatchDetailDto extends MatchSummaryDto {
  watchOptions: WatchOptionDto[];
  live?: LiveScoreDto | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_REGION = 'IN';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

// ---------- Step 4: API responses ----------

export interface BroadcasterDto {
  id: string;
  name: string;
  type: BroadcasterType;
  logoUrl?: string | null;
}

export interface TournamentListItemDto extends TournamentDto {
  matchCount: number;
  liveCount: number;
}

export interface StandingRowDto {
  team: TeamDto;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  netRunRate: number; // rounded to 3 decimals
}

export interface TournamentDetailDto extends TournamentDto {
  standings: StandingRowDto[];
}

/** Server-Sent Events on GET /v1/matches/:id/live */
export type LiveEventType = 'score' | 'ping';

export interface ApiErrorDto {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// ---------- Step 5: admin ----------

export interface AdminBroadcasterDto extends BroadcasterDto {
  appDeeplinkTemplate: string | null;
  webUrlTemplate: string | null;
  affiliateUrl: string | null;
  isActive: boolean;
  rightsCount: number;
}

export interface AdminBroadcasterInput {
  name: string;
  type: BroadcasterType;
  logoUrl?: string | null;
  appDeeplinkTemplate?: string | null;
  webUrlTemplate?: string | null;
  affiliateUrl?: string | null;
  isActive?: boolean;
}

export interface AdminRightDto {
  id: string;
  broadcaster: { id: string; name: string };
  tournament: { id: string; name: string };
  match: { id: string; label: string; startTimeUtc: string } | null; // null = whole tournament
  regionCode: string;
  language: string;
  isFree: boolean;
  validFrom: string;
  validTo: string;
}

export interface AdminRightInput {
  broadcasterId: string;
  tournamentId: string;
  matchId?: string | null;
  regionCode: string;
  language: string;
  isFree?: boolean;
  /** Defaults to the tournament start date */
  validFrom?: string;
  /** Defaults to the end of the tournament end date */
  validTo?: string;
}

export interface RightsGapDto {
  match: { id: string; label: string; startTimeUtc: string; tournamentName: string };
  regionCode: string;
}

/** Placeholders allowed in broadcaster link templates. */
export const LINK_PLACEHOLDERS = ['matchId', 'providerMatchId'] as const;
