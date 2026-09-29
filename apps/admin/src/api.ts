/** Small typed client for the admin panel. Sends X-Admin-Key on every admin call. */
import type {
  AdminBroadcasterDto,
  AdminBroadcasterInput,
  AdminRightDto,
  AdminRightInput,
  MatchSummaryDto,
  Paginated,
  RightsGapDto,
  TournamentListItemDto,
} from '@cmf/shared';

const KEY_STORAGE = 'cmf.adminKey';
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Session storage: the key is forgotten when the tab closes.
export const adminKey = {
  get: (): string | null => {
    try {
      return sessionStorage.getItem(KEY_STORAGE);
    } catch {
      return null;
    }
  },
  set: (key: string) => {
    try {
      sessionStorage.setItem(KEY_STORAGE, key);
    } catch {
      /* ignore */
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(KEY_STORAGE);
    } catch {
      /* ignore */
    }
  },
};

/** Turns Nest error bodies ({ message: string | string[] }) into one readable line. */
export function errorMessage(status: number, body: unknown): string {
  const msg = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(msg)) return msg.join('; ');
  if (typeof msg === 'string') return msg;
  return `Request failed (${status})`;
}

async function call<T>(method: string, path: string, body?: unknown, key: string | null = adminKey.get()): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(key && { 'X-Admin-Key': key }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errorMessage(res.status, data));
  return data as T;
}

export const api = {
  /** Checks a key without storing it. */
  checkKey: (key: string) => call<AdminBroadcasterDto[]>('GET', '/admin/broadcasters', undefined, key),

  broadcasters: () => call<AdminBroadcasterDto[]>('GET', '/admin/broadcasters'),
  createBroadcaster: (input: AdminBroadcasterInput) => call<AdminBroadcasterDto>('POST', '/admin/broadcasters', input),
  updateBroadcaster: (id: string, input: Partial<AdminBroadcasterInput>) =>
    call<AdminBroadcasterDto>('PATCH', `/admin/broadcasters/${id}`, input),
  deleteBroadcaster: (id: string) => call<void>('DELETE', `/admin/broadcasters/${id}`),

  rights: (filters: { tournament?: string; region?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
    return call<AdminRightDto[]>('GET', `/admin/rights${qs ? `?${qs}` : ''}`);
  },
  createRight: (input: AdminRightInput) => call<AdminRightDto>('POST', '/admin/rights', input),
  updateRight: (id: string, input: Partial<AdminRightInput>) => call<AdminRightDto>('PATCH', `/admin/rights/${id}`, input),
  deleteRight: (id: string) => call<void>('DELETE', `/admin/rights/${id}`),
  gaps: (days = 14) => call<RightsGapDto[]>('GET', `/admin/rights/gaps?days=${days}`),

  // Public endpoints used for dropdowns
  tournaments: () => call<TournamentListItemDto[]>('GET', '/tournaments?all=true'),
  matches: (tournamentId: string) =>
    call<Paginated<MatchSummaryDto>>('GET', `/matches?tournament=${tournamentId}&pageSize=100`),
};

const IST = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const IST_DATE = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (iso: string) => `${IST.format(new Date(iso))} IST`;
export const formatDate = (iso: string) => IST_DATE.format(new Date(iso));
