import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import type { WatchOptionDto } from '@cmf/shared';
import { openWatchOption, withLocalSubscriptions } from '../watch';
import { DEFAULT_PREFS, PrefsProvider, loadPrefs, usePrefs } from '../prefs';
import { apiHeaders } from '../api';

const opt = (id: string, name: string, extra: Partial<WatchOptionDto> = {}): WatchOptionDto => ({
  broadcasterId: id, name, type: 'OTT', language: 'en', isFree: false, isSubscribed: false, deepLink: null, webUrl: null, affiliateUrl: null, ...extra,
});

describe('withLocalSubscriptions', () => {
  it('marks and moves the user\'s own subscriptions to the top', () => {
    const out = withLocalSubscriptions([opt('dd', 'DD Sports', { isFree: true }), opt('hs', 'JioHotstar'), opt('sl', 'SonyLIV')], ['sl']);
    expect(out.map((o) => `${o.name}:${o.isSubscribed}`)).toEqual(['SonyLIV:true', 'DD Sports:false', 'JioHotstar:false']);
  });
});

describe('openWatchOption', () => {
  it('opens the app when it can', async () => {
    const openURL = jest.fn().mockResolvedValue(true);
    expect(await openWatchOption(opt('a', 'A', { deepLink: 'app://x', webUrl: 'https://a' }), { openURL })).toBe('app');
    expect(openURL).toHaveBeenCalledWith('app://x');
  });

  it('falls back to the website when the app is missing', async () => {
    const openURL = jest.fn().mockRejectedValueOnce(new Error('no app')).mockResolvedValue(true);
    expect(await openWatchOption(opt('a', 'A', { deepLink: 'app://x', webUrl: 'https://a' }), { openURL })).toBe('web');
    expect(openURL).toHaveBeenLastCalledWith('https://a');
  });

  it('returns none for TV-only options', async () => {
    const openURL = jest.fn();
    expect(await openWatchOption(opt('a', 'A', { type: 'TV' }), { openURL })).toBe('none');
    expect(openURL).not.toHaveBeenCalled();
  });
});

describe('prefs', () => {
  beforeEach(() => AsyncStorage.clear());

  it('starts with defaults and ignores corrupt storage', async () => {
    expect(await loadPrefs()).toEqual(DEFAULT_PREFS);
    await AsyncStorage.setItem('cmf.prefs.v1', '{not json');
    expect(await loadPrefs()).toEqual(DEFAULT_PREFS);
    await AsyncStorage.setItem('cmf.prefs.v1', JSON.stringify({ onboarded: true, region: 'india', subscriptions: ['a', 3] }));
    expect(await loadPrefs()).toEqual({ onboarded: true, region: 'IN', subscriptions: ['a'], favouriteTeams: [] });
  });

  it('saves updates, and region changes reach API headers', async () => {
    const { result } = renderHook(() => usePrefs(), { wrapper: ({ children }) => <PrefsProvider initial={DEFAULT_PREFS}>{children}</PrefsProvider> });
    await act(() => result.current.update({ region: 'GB', subscriptions: ['x'] }));
    await act(() => result.current.update({ favouriteTeams: ['t1'] })); // must keep earlier changes
    expect(result.current.prefs).toMatchObject({ region: 'GB', subscriptions: ['x'], favouriteTeams: ['t1'] });
    expect(JSON.parse((await AsyncStorage.getItem('cmf.prefs.v1'))!)).toMatchObject({ region: 'GB', subscriptions: ['x'], favouriteTeams: ['t1'] });
    expect(apiHeaders()['X-Region']).toBe('GB');
  });
});
