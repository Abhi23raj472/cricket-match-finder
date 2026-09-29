import type {
  BroadcasterDto,
  LiveScoreDto,
  MatchDetailDto,
  MatchStatus,
  MatchSummaryDto,
  Paginated,
  TournamentDetailDto,
  TournamentListItemDto,
} from '@cmf/shared';
import { getPrefs } from './prefs';
import { browserTimeZone } from './format';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      headers: { Accept: 'application/json', 'X-Region': getPrefs().region, 'X-Timezone': browserTimeZone() },
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, "We can't reach the server right now. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 404) throw new ApiError(404, "We couldn't find that page.");
    const msg = (body as { message?: string | string[] } | null)?.message;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join('; ') : msg ?? 'Something went wrong. Please try again.');
  }
  return body as T;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string | number][];
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : '';
};

export const api = {
  matches: (f: { status?: MatchStatus; tournament?: string; team?: string; pageSize?: number } = {}, signal?: AbortSignal) =>
    get<Paginated<MatchSummaryDto>>(`/matches${qs(f)}`, signal),
  match: (id: string, signal?: AbortSignal) => get<MatchDetailDto>(`/matches/${id}`, signal),
  tournaments: (signal?: AbortSignal) => get<TournamentListItemDto[]>('/tournaments', signal),
  tournament: (id: string, signal?: AbortSignal) => get<TournamentDetailDto>(`/tournaments/${id}`, signal),
  broadcasters: (signal?: AbortSignal) => get<BroadcasterDto[]>('/broadcasters', signal),
};

/** Live score stream (browser EventSource). Returns a close function. */
export function subscribeLive(matchId: string, onScore: (s: LiveScoreDto) => void, onStatus?: (open: boolean) => void): () => void {
  if (typeof EventSource === 'undefined') return () => undefined;
  const es = new EventSource(`${BASE}/matches/${matchId}/live`);
  es.onopen = () => onStatus?.(true);
  es.onerror = () => onStatus?.(false); // EventSource reconnects on its own
  es.addEventListener('score', (e) => {
    try {
      const score = JSON.parse((e as MessageEvent).data) as LiveScoreDto;
      onScore(score);
      if (score.status === 'completed' || score.status === 'abandoned') es.close();
    } catch {
      /* ignore malformed event */
    }
  });
  return () => es.close();
}
