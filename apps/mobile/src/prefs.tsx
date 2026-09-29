import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_REGION } from '@cmf/shared';
import { setApiRegion } from './api';

/**
 * Preferences kept on the phone. Login is optional (Step 7 syncs these to
 * the account); guests keep everything locally.
 */
export interface Prefs {
  onboarded: boolean;
  region: string;
  subscriptions: string[]; // broadcaster ids the user pays for
  favouriteTeams: string[]; // team ids
}

export const DEFAULT_PREFS: Prefs = { onboarded: false, region: DEFAULT_REGION, subscriptions: [], favouriteTeams: [] };
const STORAGE_KEY = 'cmf.prefs.v1';

interface PrefsContext {
  prefs: Prefs;
  loaded: boolean;
  update: (patch: Partial<Prefs>) => Promise<void>;
  reset: () => Promise<void>;
}

const Ctx = createContext<PrefsContext | null>(null);

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      onboarded: parsed.onboarded === true,
      region: typeof parsed.region === 'string' && /^[A-Z]{2}$/.test(parsed.region) ? parsed.region : DEFAULT_REGION,
      subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions.filter((x) => typeof x === 'string') : [],
      favouriteTeams: Array.isArray(parsed.favouriteTeams) ? parsed.favouriteTeams.filter((x) => typeof x === 'string') : [],
    };
  } catch {
    return DEFAULT_PREFS; // corrupt or unavailable storage: start fresh
  }
}

export function PrefsProvider({ children, initial }: { children: ReactNode; initial?: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(initial ?? DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(Boolean(initial));
  const latest = useRef(prefs);

  useEffect(() => {
    if (initial) {
      setApiRegion(initial.region);
      return;
    }
    loadPrefs().then((p) => {
      setApiRegion(p.region);
      latest.current = p;
      setPrefs(p);
      setLoaded(true);
    });
  }, [initial]);

  const update = useCallback(async (patch: Partial<Prefs>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setPrefs(next);
    if (patch.region) setApiRegion(patch.region);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full or unavailable: keep in memory for this session */
    }
  }, []);

  const reset = useCallback(async () => {
    latest.current = DEFAULT_PREFS;
    setPrefs(DEFAULT_PREFS);
    setApiRegion(DEFAULT_PREFS.region);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ prefs, loaded, update, reset }), [prefs, loaded, update, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): PrefsContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider');
  return ctx;
}

/** Countries offered in onboarding and settings. */
export { REGIONS } from '@cmf/shared';
