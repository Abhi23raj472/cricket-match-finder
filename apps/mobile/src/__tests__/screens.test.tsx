import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUS, IND, detail, mockFetch, renderWithPrefs, router, setParams, summary } from '../testing/test-utils';

jest.mock('expo-router', () => {
  const utils = jest.requireActual('../testing/test-utils');
  const Stack = () => null;
  Stack.Screen = () => null;
  return { useRouter: () => utils.router, useLocalSearchParams: () => utils.params, Stack };
});
// No real network streams in unit tests
jest.mock('../sse', () => ({ openSse: jest.fn(() => ({ close: jest.fn() })) }));

import Home from '../../app/(tabs)/index';
import MatchDetail from '../../app/match/[id]';
import WatchSheet from '../../app/watch/[id]';
import Onboarding from '../../app/onboarding';
import TournamentPage from '../../app/tournament/[id]';
import { openSse } from '../sse';

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.clear();
});

describe('Home feed', () => {
  const routes = {
    '/teams': [AUS, IND],
    '/tournaments': [{ id: 't1', name: 'Quad Series', format: 'T20', season: '2026', startDate: '2026-09-28', endDate: '2026-10-06', matchCount: 5, liveCount: 1 }],
    '/matches': (u: URL) =>
      u.searchParams.get('status') === 'completed'
        ? { items: [summary({ id: 'm9', status: 'completed', resultText: 'India won by 18 runs' })], total: 1, page: 1, pageSize: 50 }
        : { items: [summary()], total: 1, page: 1, pageSize: 50 },
  };

  it('shows live matches first, then results on the Results tab', async () => {
    const urls = mockFetch(routes);
    renderWithPrefs(<Home />);
    expect(await screen.findByText('201/4 (20.0)')).toBeTruthy();
    expect(urls.find((u) => u.startsWith('/v1/matches'))).toContain('status=live');

    fireEvent.press(screen.getByRole('tab', { name: 'Results' }));
    expect(await screen.findByText('India won by 18 runs')).toBeTruthy();
    expect(urls.filter((u) => u.startsWith('/v1/matches')).at(-1)).toContain('status=completed');
  });

  it('filters by a favourite team', async () => {
    const urls = mockFetch(routes);
    renderWithPrefs(<Home />, { favouriteTeams: ['ind'] });
    await screen.findByText('201/4 (20.0)');
    // The favourite-team chip comes before the match cards
    fireEvent.press(screen.getAllByRole('button', { name: 'India' })[0]);
    await waitFor(() => expect(urls.filter((u) => u.startsWith('/v1/matches')).at(-1)).toContain('team=ind'));
  });

  it('opens a match', async () => {
    mockFetch(routes);
    renderWithPrefs(<Home />);
    fireEvent.press(await screen.findByLabelText('India versus Australia, live'));
    expect(router.push).toHaveBeenCalledWith('/match/m1');
  });

  it('shows a friendly error with retry when the server is down', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    renderWithPrefs(<Home />);
    expect(await screen.findByText("Can't reach the server. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('Match detail', () => {
  beforeEach(() => setParams({ id: 'm1' }));

  it('shows scores, the chase, batters, last balls and commentary', async () => {
    mockFetch({ '/matches/m1': detail() });
    renderWithPrefs(<MatchDetail />);
    expect(await screen.findByText('Australia need 105 runs from 52 balls')).toBeTruthy();
    expect(screen.getAllByText('97/3 (11.2)').length).toBeGreaterThanOrEqual(1); // header + scorecard
    expect(screen.getByText('Batter E *')).toBeTruthy();
    expect(screen.getByLabelText('Last balls: 1, 4, W, 0, 6, 1')).toBeTruthy();
    expect(screen.getByText('Driven to long-on for a single.')).toBeTruthy();
    expect(openSse).toHaveBeenCalledWith(expect.stringContaining('/matches/m1/live'), expect.anything());
  });

  it("labels the watch button with the user's own subscription", async () => {
    mockFetch({ '/matches/m1': detail() });
    renderWithPrefs(<MatchDetail />, { subscriptions: ['hs'] });
    fireEvent.press(await screen.findByRole('button', { name: 'Watch on JioHotstar' }));
    expect(router.push).toHaveBeenCalledWith('/watch/m1');
  });

  it('does not open a live stream for a finished match', async () => {
    mockFetch({ '/matches/m1': detail({ status: 'completed', resultText: 'India won by 30 runs', live: { ...detail().live!, status: 'completed' } }) });
    renderWithPrefs(<MatchDetail />);
    expect(await screen.findByText('India won by 30 runs')).toBeTruthy();
    expect(openSse).not.toHaveBeenCalled();
  });
});

describe('Watch sheet', () => {
  beforeEach(() => setParams({ id: 'm1' }));

  it('lists options (yours first) and opens the app', async () => {
    mockFetch({ '/matches/m1': detail() });
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderWithPrefs(<WatchSheet />, { subscriptions: ['hs'] });
    const first = await screen.findByLabelText('Open JioHotstar, English');
    expect(screen.getByText('You have this')).toBeTruthy();
    fireEvent.press(first);
    await waitFor(() => expect(openURL).toHaveBeenCalledWith('hotstar://m/1'));
  });

  it('explains TV-only options', async () => {
    mockFetch({ '/matches/m1': detail() });
    renderWithPrefs(<WatchSheet />);
    fireEvent.press(await screen.findByLabelText('About DD Sports, Hindi'));
    expect(await screen.findByText('DD Sports is on TV. Check your TV guide for the channel.')).toBeTruthy();
  });

  it('says when nothing is available in the country', async () => {
    mockFetch({ '/matches/m1': detail({ watchOptions: [] }) });
    renderWithPrefs(<WatchSheet />, { region: 'GB' });
    expect(await screen.findByText("We don't know of an official broadcaster for this match in United Kingdom yet.")).toBeTruthy();
  });
});

describe('Onboarding', () => {
  it('saves country, subscriptions and teams', async () => {
    mockFetch({ '/broadcasters': [{ id: 'hs', name: 'JioHotstar', type: 'OTT' }], '/teams': [AUS, IND] });
    renderWithPrefs(<Onboarding />, { onboarded: false });
    fireEvent.press(screen.getByRole('button', { name: 'Australia' }));
    fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    fireEvent.press(await screen.findByRole('button', { name: 'JioHotstar' }));
    fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    fireEvent.press(await screen.findByRole('button', { name: 'India' }));
    fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(JSON.parse((await AsyncStorage.getItem('cmf.prefs.v1'))!)).toEqual({ onboarded: true, region: 'AU', subscriptions: ['hs'], favouriteTeams: ['ind'] });
  });

  it('can be skipped', async () => {
    mockFetch({ '/broadcasters': [], '/teams': [] });
    renderWithPrefs(<Onboarding />, { onboarded: false });
    fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(JSON.parse((await AsyncStorage.getItem('cmf.prefs.v1'))!)).toMatchObject({ onboarded: true, region: 'IN' });
  });
});

describe('Tournament page', () => {
  it('shows fixtures and the points table', async () => {
    setParams({ id: 't1' });
    mockFetch({
      '/tournaments/t1': {
        id: 't1', name: 'Quad Series', format: 'T20', season: '2026', startDate: '2026-09-28', endDate: '2026-10-06',
        standings: [
          { team: IND, played: 2, won: 2, lost: 0, tied: 0, noResult: 0, points: 4, netRunRate: 1.25 },
          { team: AUS, played: 2, won: 0, lost: 2, tied: 0, noResult: 0, points: 0, netRunRate: -1.25 },
        ],
      },
      '/matches': { items: [summary({ status: 'upcoming', scores: [] })], total: 1, page: 1, pageSize: 100 },
    });
    renderWithPrefs(<TournamentPage />);
    expect(await screen.findByLabelText('India versus Australia, upcoming')).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: 'Table' }));
    expect(await screen.findByText('1. India')).toBeTruthy();
    expect(screen.getByText('+1.250')).toBeTruthy();
    expect(screen.getByText('-1.250')).toBeTruthy();
  });
});
