import { useCallback, useEffect, useRef, useState } from 'react';

export interface Async<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads data and cancels on unmount / dep change.
 * refreshEveryMs: quietly re-fetch in the background (keeps old data on screen).
 */
export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[], refreshEveryMs?: number): Async<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const quiet = useRef(false);

  useEffect(() => {
    const ctrl = new AbortController();
    if (!quiet.current) {
      setLoading(true);
      setData(null);
      setError(null);
    }
    fn(ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setData(d);
        setError(null);
      })
      .catch((e: Error) => {
        // a failed background refresh keeps the old data
        if (!ctrl.signal.aborted && e.name !== 'AbortError' && !quiet.current) setError(e.message);
      })
      .finally(() => {
        if (ctrl.signal.aborted) return;
        setLoading(false);
        quiet.current = false;
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    if (!refreshEveryMs) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      quiet.current = true;
      setTick((t) => t + 1);
    }, refreshEveryMs);
    return () => clearInterval(id);
  }, [refreshEveryMs]);

  const reload = useCallback(() => {
    quiet.current = false;
    setTick((t) => t + 1);
  }, []);

  return { data, error, loading, reload };
}

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Match Finder` : 'Match Finder';
  }, [title]);
}
