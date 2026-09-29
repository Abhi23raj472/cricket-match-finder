import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AdminBroadcasterDto, AdminRightDto, AdminRightInput, MatchSummaryDto, TournamentListItemDto } from '@cmf/shared';
import { api, formatDate, formatDateTime } from '../api';

const LANGUAGES = [
  ['en', 'English'],
  ['hi', 'Hindi'],
  ['ta', 'Tamil'],
  ['te', 'Telugu'],
  ['kn', 'Kannada'],
  ['bn', 'Bengali'],
  ['mr', 'Marathi'],
  ['ml', 'Malayalam'],
] as const;
const languageName = (code: string) => LANGUAGES.find(([c]) => c === code)?.[1] ?? code;

interface FormState {
  broadcasterId: string;
  tournamentId: string;
  matchId: string; // '' = whole tournament
  regionCode: string;
  language: string;
  isFree: boolean;
  validFrom: string; // '' = tournament start
  validTo: string; // '' = tournament end
}

const EMPTY: FormState = { broadcasterId: '', tournamentId: '', matchId: '', regionCode: 'IN', language: 'en', isFree: false, validFrom: '', validTo: '' };

export function RightsPage() {
  const [rights, setRights] = useState<AdminRightDto[] | null>(null);
  const [broadcasters, setBroadcasters] = useState<AdminBroadcasterDto[]>([]);
  const [tournaments, setTournaments] = useState<TournamentListItemDto[]>([]);
  const [matches, setMatches] = useState<MatchSummaryDto[]>([]);
  const [filter, setFilter] = useState({ tournament: '', region: '' });
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRights = () => api.rights(filter).then(setRights).catch((e: Error) => setError(e.message));

  useEffect(() => {
    Promise.all([api.broadcasters(), api.tournaments()])
      .then(([b, t]) => {
        setBroadcasters(b);
        setTournaments(t);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    loadRights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.tournament, filter.region]);

  // Matches for the tournament chosen in the form
  useEffect(() => {
    setMatches([]);
    if (!form.tournamentId) return;
    api
      .matches(form.tournamentId)
      .then((p) => setMatches(p.items))
      .catch((e: Error) => setError(e.message));
  }, [form.tournamentId]);

  const regions = useMemo(() => [...new Set((rights ?? []).map((r) => r.regionCode))].sort(), [rights]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  function edit(r: AdminRightDto) {
    setEditingId(r.id);
    setForm({
      broadcasterId: r.broadcaster.id,
      tournamentId: r.tournament.id,
      matchId: r.match?.id ?? '',
      regionCode: r.regionCode,
      language: r.language,
      isFree: r.isFree,
      validFrom: r.validFrom.slice(0, 10),
      validTo: r.validTo.slice(0, 10),
    });
    setError(null);
    setNotice(null);
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const input: AdminRightInput = {
      broadcasterId: form.broadcasterId,
      tournamentId: form.tournamentId,
      matchId: form.matchId || null,
      regionCode: form.regionCode.trim().toUpperCase(),
      language: form.language.trim(),
      isFree: form.isFree,
      ...(form.validFrom && { validFrom: form.validFrom }),
      ...(form.validTo && { validTo: form.validTo }),
    };
    try {
      if (editingId) await api.updateRight(editingId, input);
      else await api.createRight(input);
      setNotice(editingId ? 'Right updated.' : 'Right added.');
      reset();
      await loadRights();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: AdminRightDto) {
    if (!window.confirm(`Remove ${r.broadcaster.name} (${languageName(r.language)}, ${r.regionCode}) for ${r.match?.label ?? r.tournament.name}?`)) return;
    setError(null);
    try {
      await api.deleteRight(r.id);
      setNotice('Right removed.');
      await loadRights();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <h2>Broadcast rights</h2>
        <p className="muted">
          Who shows each tournament, in which country and language. A right for a single match <strong>replaces</strong> the
          tournament-wide rights for that match.
        </p>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}

      <div className="filters">
        <label>
          Tournament
          <select value={filter.tournament} onChange={(e) => setFilter((f) => ({ ...f, tournament: e.target.value }))}>
            <option value="">All tournaments</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Country
          <select value={filter.region} onChange={(e) => setFilter((f) => ({ ...f, region: e.target.value }))}>
            <option value="">All countries</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card">
        {rights === null ? (
          <p className="muted">Loading…</p>
        ) : rights.length === 0 ? (
          <p className="muted">No rights match these filters.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tournament</th>
                  <th>Applies to</th>
                  <th>Broadcaster</th>
                  <th>Country</th>
                  <th>Language</th>
                  <th>Valid</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rights.map((r) => (
                  <tr key={r.id}>
                    <td>{r.tournament.name}</td>
                    <td>
                      {r.match ? (
                        <>
                          <span className="badge override">Single match</span> {r.match.label}
                          <div className="muted small">{formatDateTime(r.match.startTimeUtc)}</div>
                        </>
                      ) : (
                        'Whole tournament'
                      )}
                    </td>
                    <td className="strong">
                      {r.broadcaster.name} {r.isFree && <span className="badge ok">Free</span>}
                    </td>
                    <td>{r.regionCode}</td>
                    <td>{languageName(r.language)}</td>
                    <td className="small">
                      <div className="nowrap">{formatDate(r.validFrom)} –</div>
                      <div className="nowrap">{formatDate(r.validTo)}</div>
                    </td>
                    <td className="actions">
                      <button onClick={() => edit(r)}>Edit</button>
                      <button className="danger" onClick={() => remove(r)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form className="card form" onSubmit={submit} aria-label={editingId ? 'Edit right' : 'Add right'}>
        <h3>{editingId ? 'Edit right' : 'Add a right'}</h3>
        <div className="grid">
          <label>
            Broadcaster
            <select value={form.broadcasterId} onChange={(e) => set('broadcasterId', e.target.value)} required>
              <option value="">Choose…</option>
              {broadcasters.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tournament
            <select
              value={form.tournamentId}
              onChange={(e) => setForm((f) => ({ ...f, tournamentId: e.target.value, matchId: '' }))}
              required
            >
              <option value="">Choose…</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            Applies to
            <select value={form.matchId} onChange={(e) => set('matchId', e.target.value)} disabled={!form.tournamentId}>
              <option value="">Whole tournament</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.homeTeam.shortCode} v {m.awayTeam.shortCode}
                  {m.matchNo ? ` · ${m.matchNo}` : ''} — {formatDateTime(m.startTimeUtc)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Country code
            <input value={form.regionCode} onChange={(e) => set('regionCode', e.target.value)} maxLength={2} required pattern="[A-Za-z]{2}" title="2-letter country code, e.g. IN" />
          </label>
          <label>
            Language
            <select value={form.language} onChange={(e) => set('language', e.target.value)}>
              {LANGUAGES.map(([c, n]) => (
                <option key={c} value={c}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>
              Valid from <span className="muted">(optional)</span>
            </span>
            <input type="date" value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)} />
          </label>
          <label>
            <span>
              Valid to <span className="muted">(optional)</span>
            </span>
            <input type="date" value={form.validTo} onChange={(e) => set('validTo', e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={form.isFree} onChange={(e) => set('isFree', e.target.checked)} />
            Free to watch
          </label>
        </div>
        <p className="hint">Leave the dates empty to use the tournament's start and end dates.</p>
        <div className="form-actions">
          {editingId && (
            <button type="button" onClick={reset}>
              Cancel
            </button>
          )}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add right'}
          </button>
        </div>
      </form>
    </section>
  );
}
