import { useSyncExternalStore } from 'react';
import { DEFAULT_REGION } from '@cmf/shared';

/** Country and subscriptions, remembered in this browser. */
export interface Prefs {
  region: string;
  subscriptions: string[];
}

const KEY = 'cmf.web.prefs.v1';
const DEFAULTS: Prefs = { region: DEFAULT_REGION, subscriptions: [] };
const listeners = new Set<() => void>();

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      region: typeof p.region === 'string' && /^[A-Z]{2}$/.test(p.region) ? p.region : DEFAULT_REGION,
      subscriptions: Array.isArray(p.subscriptions) ? p.subscriptions.filter((x) => typeof x === 'string') : [],
    };
  } catch {
    return DEFAULTS;
  }
}

let current: Prefs = read();

export const getPrefs = () => current;

export function setPrefs(patch: Partial<Prefs>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode or storage blocked: keep for this visit */
  }
  listeners.forEach((l) => l());
}

/** For tests. */
export function resetPrefs() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  current = read();
  listeners.forEach((l) => l());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
