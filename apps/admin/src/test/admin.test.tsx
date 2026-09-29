import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { adminKey, errorMessage } from '../api';
import { KeyGate } from '../pages/KeyGate';
import { BroadcastersPage } from '../pages/BroadcastersPage';
import { RightsPage } from '../pages/RightsPage';
import { GapsPage } from '../pages/GapsPage';
import { App } from '../App';
import { fakeApi } from './fake-api';
import { fancode, hotstar, match, right, tournament } from './fixtures';

describe('errorMessage', () => {
  it('joins validation messages and falls back to the status', () => {
    expect(errorMessage(400, { message: ['a', 'b'] })).toBe('a; b');
    expect(errorMessage(409, { message: 'dup' })).toBe('dup');
    expect(errorMessage(500, null)).toBe('Request failed (500)');
  });
});

describe('KeyGate', () => {
  it('shows an error for a wrong key and does not store it', async () => {
    fakeApi({ 'GET /v1/admin/broadcasters': () => ({ status: 401, body: { message: 'Missing or wrong X-Admin-Key' } }) });
    const onUnlocked = vi.fn();
    render(<KeyGate onUnlocked={onUnlocked} />);
    await userEvent.type(screen.getByLabelText('Admin key'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That key is not correct.');
    expect(onUnlocked).not.toHaveBeenCalled();
    expect(adminKey.get()).toBeNull();
  });

  it('stores a working key and unlocks', async () => {
    const { calls } = fakeApi({ 'GET /v1/admin/broadcasters': [] });
    const onUnlocked = vi.fn();
    render(<KeyGate onUnlocked={onUnlocked} />);
    await userEvent.type(screen.getByLabelText('Admin key'), ' secret ');
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
    expect(adminKey.get()).toBe('secret');
    expect(calls[0].headers['X-Admin-Key']).toBe('secret');
  });
});

describe('BroadcastersPage', () => {
  it('lists broadcasters and only allows deleting ones without rights', async () => {
    adminKey.set('k');
    fakeApi({ 'GET /v1/admin/broadcasters': [hotstar, fancode] });
    render(<BroadcastersPage />);
    const hotRow = (await screen.findByText('JioHotstar')).closest('tr')!;
    const fcRow = screen.getByText('FanCode').closest('tr')!;
    expect(within(hotRow).getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(within(fcRow).getByRole('button', { name: 'Delete' })).toBeEnabled();
    expect(within(fcRow).getByText('Inactive')).toBeInTheDocument();
  });

  it('adds a broadcaster and shows server validation errors', async () => {
    adminKey.set('k');
    let attempts = 0;
    const { calls } = fakeApi({
      'GET /v1/admin/broadcasters': [hotstar],
      'POST /v1/admin/broadcasters': () =>
        ++attempts === 1 ? { status: 400, body: { message: ['webUrlTemplate must start with https://'] } } : { status: 201, body: hotstar },
    });
    render(<BroadcastersPage />);
    const form = await screen.findByRole('form', { name: 'Add broadcaster' });
    await userEvent.type(within(form).getByLabelText('Name'), 'SonyLIV');
    await userEvent.type(within(form).getByLabelText('Web link'), 'http://sonyliv.com');
    await userEvent.click(within(form).getByRole('button', { name: 'Add broadcaster' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('webUrlTemplate must start with https://');

    await userEvent.clear(within(form).getByLabelText('Web link'));
    await userEvent.type(within(form).getByLabelText('Web link'), 'https://www.sonyliv.com');
    await userEvent.click(within(form).getByRole('button', { name: 'Add broadcaster' }));
    expect(await screen.findByRole('status')).toHaveTextContent('SonyLIV added.');
    const post = calls.filter((c) => c.method === 'POST').at(-1)!;
    expect(post.body).toMatchObject({ name: 'SonyLIV', type: 'OTT', webUrlTemplate: 'https://www.sonyliv.com', isActive: true });
  });

  it('deactivates with a PATCH of just isActive', async () => {
    adminKey.set('k');
    const { calls } = fakeApi({ 'GET /v1/admin/broadcasters': [hotstar], 'PATCH /v1/admin/broadcasters/b1': hotstar });
    render(<BroadcastersPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ isActive: false });
  });
});

describe('RightsPage', () => {
  const routes = () => ({
    'GET /v1/admin/broadcasters': [hotstar],
    'GET /v1/tournaments': [tournament],
    'GET /v1/admin/rights': [right],
    'GET /v1/matches': { items: [match], total: 1, page: 1, pageSize: 100 },
    'POST /v1/admin/rights': { status: 201, body: right },
  });

  it('lists rights in readable form', async () => {
    adminKey.set('k');
    fakeApi(routes());
    render(<RightsPage />);
    const row = (await screen.findByRole('cell', { name: 'Whole tournament' })).closest('tr')!;
    expect(within(row).getByText('JioHotstar')).toBeInTheDocument();
    expect(within(row).getByText('Hindi')).toBeInTheDocument();
  });

  it('loads the tournament matches and sends a single-match right', async () => {
    adminKey.set('k');
    const { calls } = fakeApi(routes());
    render(<RightsPage />);
    const form = await screen.findByRole('form', { name: 'Add right' });
    await screen.findByRole('option', { name: 'JioHotstar' });
    await userEvent.selectOptions(within(form).getByLabelText('Broadcaster'), 'b1');
    await userEvent.selectOptions(within(form).getByLabelText('Tournament'), 't1');
    const appliesTo = within(form).getByLabelText('Applies to');
    await within(appliesTo).findByRole('option', { name: /IND v AUS · Final/ });
    await userEvent.selectOptions(appliesTo, 'm1');
    await userEvent.selectOptions(within(form).getByLabelText('Language'), 'ta');
    await userEvent.click(within(form).getByLabelText('Free to watch'));
    await userEvent.click(within(form).getByRole('button', { name: 'Add right' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Right added.');
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toEqual({ broadcasterId: 'b1', tournamentId: 't1', matchId: 'm1', regionCode: 'IN', language: 'ta', isFree: true });
    expect(calls.find((c) => c.path === '/v1/matches')!.search).toContain('tournament=t1');
  });

  it('shows a conflict from the server', async () => {
    adminKey.set('k');
    fakeApi({ ...routes(), 'POST /v1/admin/rights': () => ({ status: 409, body: { message: 'This broadcaster already has hi rights for this tournament in IN' } }) });
    render(<RightsPage />);
    const form = await screen.findByRole('form', { name: 'Add right' });
    await screen.findByRole('option', { name: 'JioHotstar' });
    await userEvent.selectOptions(within(form).getByLabelText('Broadcaster'), 'b1');
    await userEvent.selectOptions(within(form).getByLabelText('Tournament'), 't1');
    await userEvent.click(within(form).getByRole('button', { name: 'Add right' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already has hi rights');
  });
});

describe('GapsPage', () => {
  it('lists gaps and links to the rights tab', async () => {
    adminKey.set('k');
    fakeApi({
      'GET /v1/admin/rights/gaps': [
        { match: { id: 'm1', label: 'IND v AUS · Final', startTimeUtc: '2026-10-05T14:00:00Z', tournamentName: 'T20 Quad Series' }, regionCode: 'GB' },
      ],
    });
    const onFix = vi.fn();
    render(<GapsPage onFix={onFix} />);
    expect(await screen.findByText('1 gap found.')).toBeInTheDocument();
    expect(screen.getByText('IND v AUS · Final')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add rights' }));
    expect(onFix).toHaveBeenCalled();
  });

  it('says so when there are no gaps', async () => {
    adminKey.set('k');
    fakeApi({ 'GET /v1/admin/rights/gaps': [] });
    render(<GapsPage onFix={() => {}} />);
    expect(await screen.findByText(/Every match in the next 14 days/)).toBeInTheDocument();
  });
});

describe('App', () => {
  it('asks for the key first, and Lock forgets it', async () => {
    adminKey.set('k');
    fakeApi({ 'GET /v1/admin/broadcasters': [], 'GET /v1/tournaments': [], 'GET /v1/admin/rights': [] });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Lock' }));
    expect(screen.getByLabelText('Admin key')).toBeInTheDocument();
    expect(adminKey.get()).toBeNull();
  });
});
