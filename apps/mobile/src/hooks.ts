import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveScoreDto, MatchStatus } from '@cmf/shared';
import { api, apiHeaders } from './api';
import { openSse } from './sse';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  reload: () => void;
  refresh: () => void; // pull-to-refresh: keeps showing old data
}

/** Loads data, cancels on unmount or when deps change. */
export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const mode = useRef<'load' | 'refresh'>('load');

  useEffect(() => {
    const ctrl = new AbortController();
    if (mode.current === 'refresh') setRefreshing(true);
    else {
      setLoading(true);
      setData(null);
    }
    setError(null);
    fn(ctrl.signal)
      .then((d) => !ctrl.signal.aborted && setData(d))
      .catch((e: Error) => !ctrl.signal.aborted && e.name !== 'AbortError' && setError(e.message))
      .finally(() => {
        if (ctrl.signal.aborted) return;
        setLoading(false);
        setRefreshing(false);
        mode.current = 'load';
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => {
    mode.current = 'load';
    setTick((t) => t + 1);
  }, []);
  const refresh = useCallback(() => {
    mode.current = 'refresh';
    setTick((t) => t + 1);
  }, []);

  return { data, error, loading, refreshing, reload, refresh };
}

const isFinal = (s: MatchStatus | undefined) => s === 'completed' || s === 'abandoned';

/**
 * Live scorecard for a match: starts from `initial`, then follows the SSE
 * stream while the match is live or about to start.
 */
export function useLiveScore(matchId: string, initial: LiveScoreDto | null | undefined, status: MatchStatus | undefined) {
  const [score, setScore] = useState<LiveScoreDto | null>(initial ?? null);
  const [connection, setConnection] = useState<'connecting' | 'open' | 'reconnecting' | 'closed'>('closed');
  const latest = useRef<LiveScoreDto | null>(initial ?? null);

  useEffect(() => {
    latest.current = initial ?? null;
    setScore(initial ?? null);
  }, [initial]);

  useEffect(() => {
    if (!status || isFinal(status)) return;
    const stream = openSse(api.liveUrl(matchId), {
      headers: apiHeaders(),
      onStatusChange: setConnection,
      isDone: () => isFinal(latest.current?.status),
      onEvent: (e) => {
        if (e.event !== 'score') return;
        try {
          const next = JSON.parse(e.data) as LiveScoreDto;
          latest.current = next;
          setScore(next);
        } catch {
          /* ignore malformed event */
        }
      },
    });
    return () => stream.close();
  }, [matchId, status]);

  return { score, connection };
}
