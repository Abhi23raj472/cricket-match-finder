import { vi } from 'vitest';

type Handler = (body: any, url: URL) => { status?: number; body?: unknown };

/** Routes fetch() calls to handlers keyed by "METHOD /path" (query string ignored). Records every call. */
export function fakeApi(routes: Record<string, Handler | unknown>) {
  const calls: { method: string; path: string; search: string; body: any; headers: Record<string, string> }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, search: url.search, body, headers: (init.headers ?? {}) as Record<string, string> });
    const route = routes[`${method} ${url.pathname}`];
    if (route === undefined) return new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
    const result = typeof route === 'function' ? (route as Handler)(body, url) : { body: route };
    const status = result.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(result.body ?? {}), { status });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
