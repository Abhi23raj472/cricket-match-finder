import type {
  BroadcasterDto,
  MatchDetailDto,
  MatchStatus,
  MatchSummaryDto,
  Paginated,
  TeamDto,
  TournamentDetailDto,
  TournamentListItemDto,
} from '@cmf/shared';
import { API_URL } from './config';
import { deviceTimeZone } from './format';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Region comes from the user's saved preference; set by PrefsProvider. */
let region = 'IN';
export const setApiRegion = (r: string) => {
  region = r;
};

export function apiHeaders(): Record<string, string> {
  return { 'X-Region': region, 'X-Timezone': deviceTimeZone(), Accept: 'application/json' };
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, { headers: apiHeaders(), signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body as { message?: string | string[] } | null)?.message;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join('; ') : msg ?? `Something went wrong (${res.status})`);
  }
  return body as T;
}

export interface MatchFilters {
  status?: MatchStatus;
  tournament?: string;
  team?: string;
  page?: number;
  pageSize?: number;
}

const qs = (params: object) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}` : '';
};

export const api = {
  matches: (f: MatchFilters = {}, signal?: AbortSignal) => get<Paginated<MatchSummaryDto>>(`/matches${qs(f)}`, signal),
  match: (id: string, signal?: AbortSignal) => get<MatchDetailDto>(`/matches/${id}`, signal),
  tournaments: (signal?: AbortSignal) => get<TournamentListItemDto[]>('/tournaments', signal),
  tournament: (id: string, signal?: AbortSignal) => get<TournamentDetailDto>(`/tournaments/${id}`, signal),
  broadcasters: (signal?: AbortSignal) => get<BroadcasterDto[]>('/broadcasters', signal),
  teams: (signal?: AbortSignal) => get<TeamDto[]>('/teams', signal),
  liveUrl: (id: string) => `${API_URL}/matches/${id}/live`,
};
