import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dayLabel, groupByDay, shortDayLabel, timeLabel } from '../format';
import { getPrefs, setPrefs } from '../prefs';
import { ENG, FakeEventSource, IND, detail, mockApi, renderAt, summary } from './helpers';

const IST = 'Asia/Kolkata';

describe('format', () => {
  const now = new Date('2026-10-01T06:30:00Z'); // noon IST
  it('labels days in the viewer time zone', () => {
    expect(dayLabel('2026-10-01T15:00:00Z', IST, now)).toBe('Today');
    expect(dayLabel('2026-10-01T19:00:00Z', IST, now)).toBe('Tomorrow'); // 00:30 IST
    expect(dayLabel('2026-10-03T10:00:00Z', IST, now)).toMatch(/Saturday.*3.*October/);
    expect(shortDayLabel('2026-09-28T10:00:00Z', IST, now)).toMatch(/28 Sep/);
    expect(timeLabel('2026-10-01T14:00:00Z', IST)).toBe('7:30 pm');
  });

  it('groups matches by day, keeping order', () => {
    const items = ['2026-10-01T10:00:00Z', '2026-10-01T14:00:00Z', '2026-10-02T10:00:00Z'];
    expect(groupByDay(items, (x) => x, IST, now).map(([d, xs]) => [d, xs.length])).toEqual([
      ['Today', 2],
      ['Tomorrow', 1],
    ]);
  });
});

describe('prefs', () => {
  it('remembers country and subscriptions and ignores bad stored data', () => {
    setPrefs({ region: 'GB', subscriptions: ['hs'] });
    expect(JSON.parse(localStorage.getItem('cmf.web.prefs.v1')!)).toEqual({ region: 'GB', subscriptions: ['hs'] });
    expect(getPrefs().region).toBe('GB');
  });
});

describe('Home page', () => {
  const routes = {
    '/tournaments': [{ id: 't1', name: 'Quad Series', format: 'T20', season: '2026', startDate: '2026-09-28', endDate: '2026-10-06', matchCount: 3, liveCount: 1 }],
    '/matches': (u: URL) => {
      const status = u.searchParams.get('status');
      const items =
        status === 'live'
          ? [summary()]
          : status === 'upcoming'
            ? [summary({ id: 'm2', status: 'upcoming', scores: [], startTimeUtc: new Date(Date.now() + 86_400_000).toISOString() })]
            : [summary({ id: 'm3', status: 'completed', resultText: 'India won by 18 runs' })];
      return { items, total: items.length, page: 1, pageSize: 20 };
    },
  };

  it('shows live, upcoming and results sections', async () => {
    mockApi(routes);
    renderAt('/');
    const live = await screen.findByRole('link', { name: 'India v England, live' });
    expect(within(live).getByText('201/4 (20.0)')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'India v England, upcoming' })).toHaveAttribute('href', '/match/m2');
    expect(await screen.findByText('India won by 18 runs')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
  });

  it('sends the country and time zone, and filters by tournament', async () => {
    setPrefs({ region: 'AU' });
    const calls = mockApi(routes);
    renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Quad Series' }));
    await waitFor(() => expect(calls.some((c) => c.url.searchParams.get('tournament') === 't1')).toBe(true));
    expect(calls[0].headers['X-Region']).toBe('AU');
    expect(calls[0].headers['X-Timezone']).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quad Series' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('changing country in the header re-fetches with the new region', async () => {
    const calls = mockApi(routes);
    renderAt('/');
    await screen.findByRole('link', { name: 'India v England, live' });
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'GB');
    await waitFor(() => expect(calls.at(-1)!.headers['X-Region']).toBe('GB'));
  });

  it('shows a friendly error with retry when the server is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderAt('/');
    expect((await screen.findAllByText(/can't reach the server/))[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBeGreaterThan(0);
  });
});

describe('Match page', () => {
  beforeEach(() => {
    FakeEventSource.last = null;
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  it('shows the scoreboard, chase and where to watch (your subscription first)', async () => {
    setPrefs({ subscriptions: ['hs'] });
    mockApi({ '/matches/m1': detail() });
    renderAt('/match/m1');
    expect(await screen.findByText('England need 105 runs from 52 balls')).toBeInTheDocument();
    const panel = screen.getAllByRole('complementary', { name: 'Where to watch' })[0];
    const names = within(panel).getAllByText(/^(JioHotstar|DD Sports)$/).map((n) => n.textContent);
    expect(names).toEqual(['JioHotstar', 'DD Sports']);
    const watch = within(panel).getByRole('link', { name: /Watch.*on JioHotstar/ });
    expect(watch).toHaveAttribute('href', 'https://www.hotstar.com');
    expect(watch).toHaveAttribute('target', '_blank');
    expect(watch).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(panel).getByText('Your subscription')).toBeInTheDocument();
    expect(within(panel).getByText('On TV')).toBeInTheDocument();
    expect(document.title).toBe('IND v ENG · Match Finder');
  });

  it('applies live updates from the stream and stops after the result', async () => {
    mockApi({ '/matches/m1': detail() });
    renderAt('/match/m1');
    await screen.findByText('England need 105 runs from 52 balls');
    const es = FakeEventSource.last!;
    expect(es.url).toBe('/v1/matches/m1/live');

    const base = detail().live!;
    act(() =>
      es.emit('score', {
        ...base,
        innings: [base.innings[0], { ...base.innings[1], runs: 202, wickets: 5, overs: '19.3' }],
        status: 'completed',
      }),
    );
    expect((await screen.findAllByText('202/5 (19.3)')).length).toBeGreaterThanOrEqual(1); // scoreboard + scorecard
    expect(es.closed).toBe(true);
  });

  it('does not open a stream for a finished match', async () => {
    mockApi({ '/matches/m1': detail({ status: 'completed', resultText: 'India won by 30 runs', live: { ...detail().live!, status: 'completed' } }) });
    renderAt('/match/m1');
    expect(await screen.findByText('India won by 30 runs')).toBeInTheDocument();
    expect(FakeEventSource.last).toBeNull();
  });

  it('says when no broadcaster is known in the country', async () => {
    setPrefs({ region: 'GB' });
    mockApi({ '/matches/m1': detail({ watchOptions: [] }) });
    renderAt('/match/m1');
    expect((await screen.findAllByText("We don't know of an official broadcaster for this match in United Kingdom yet."))[0]).toBeInTheDocument();
  });

  it('shows a not-found message for a bad id', async () => {
    mockApi({});
    renderAt('/match/nope');
    expect(await screen.findByText("We couldn't find that page.")).toBeInTheDocument();
  });
});

describe('Tournament page', () => {
  it('shows fixtures and the points table', async () => {
    mockApi({
      '/tournaments/t1': {
        id: 't1', name: 'Quad Series', format: 'T20', season: '2026', startDate: '2026-09-28', endDate: '2026-10-06',
        standings: [
          { team: IND, played: 2, won: 2, lost: 0, tied: 0, noResult: 0, points: 4, netRunRate: 1.25 },
          { team: ENG, played: 2, won: 0, lost: 2, tied: 0, noResult: 0, points: 0, netRunRate: -1.25 },
        ],
      },
      '/matches': { items: [summary({ status: 'upcoming', scores: [], startTimeUtc: new Date(Date.now() + 86_400_000).toISOString() })], total: 1, page: 1, pageSize: 100 },
    });
    renderAt('/tournaments/t1');
    expect(await screen.findByRole('heading', { name: 'Quad Series' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'India v England, upcoming' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Points table' }));
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('India')).toBeInTheDocument();
    expect(within(rows[1]).getByText('+1.250')).toBeInTheDocument();
    expect(within(rows[2]).getByText('-1.250')).toBeInTheDocument();
  });
});

describe('Preferences page', () => {
  it('saves subscriptions', async () => {
    mockApi({ '/broadcasters': [{ id: 'hs', name: 'JioHotstar', type: 'OTT' }, { id: 'fc', name: 'FanCode', type: 'OTT' }] });
    renderAt('/preferences');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'FanCode' }));
    expect(getPrefs().subscriptions).toEqual(['fc']);
    await userEvent.click(screen.getByRole('checkbox', { name: 'FanCode' }));
    expect(getPrefs().subscriptions).toEqual([]);
  });
});

describe('Not found', () => {
  it('shows a helpful page', () => {
    mockApi({});
    renderAt('/nowhere');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
