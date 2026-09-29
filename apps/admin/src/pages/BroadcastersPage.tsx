import { useEffect, useState, type FormEvent } from 'react';
import type { AdminBroadcasterDto, AdminBroadcasterInput, BroadcasterType } from '@cmf/shared';
import { api } from '../api';

const EMPTY: AdminBroadcasterInput = { name: '', type: 'OTT', logoUrl: '', appDeeplinkTemplate: '', webUrlTemplate: '', affiliateUrl: '', isActive: true };
const TYPE_LABEL: Record<BroadcasterType, string> = { OTT: 'Streaming (OTT)', TV: 'TV channel', FREE: 'Free-to-air' };

export function BroadcastersPage() {
  const [list, setList] = useState<AdminBroadcasterDto[] | null>(null);
  const [form, setForm] = useState<AdminBroadcasterInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.broadcasters().then(setList).catch((e: Error) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const set = <K extends keyof AdminBroadcasterInput>(k: K, v: AdminBroadcasterInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  function edit(b: AdminBroadcasterDto) {
    setEditingId(b.id);
    setForm({
      name: b.name,
      type: b.type,
      logoUrl: b.logoUrl ?? '',
      appDeeplinkTemplate: b.appDeeplinkTemplate ?? '',
      webUrlTemplate: b.webUrlTemplate ?? '',
      affiliateUrl: b.affiliateUrl ?? '',
      isActive: b.isActive,
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
    try {
      if (editingId) await api.updateBroadcaster(editingId, form);
      else await api.createBroadcaster(form);
      setNotice(`${form.name.trim()} ${editingId ? 'updated' : 'added'}.`);
      reset();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(b: AdminBroadcasterDto) {
    setError(null);
    try {
      await api.updateBroadcaster(b.id, { isActive: !b.isActive });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(b: AdminBroadcasterDto) {
    if (!window.confirm(`Delete ${b.name}? This cannot be undone.`)) return;
    setError(null);
    try {
      await api.deleteBroadcaster(b.id);
      setNotice(`${b.name} deleted.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <h2>Broadcasters</h2>
        <p className="muted">Where matches can be watched. Hide a broadcaster with Deactivate instead of deleting it if it has rights.</p>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}

      <div className="card">
        {list === null ? (
          <p className="muted">Loading…</p>
        ) : list.length === 0 ? (
          <p className="muted">No broadcasters yet. Add the first one below.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Links</th>
                  <th className="num">Rights</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id} className={b.isActive ? '' : 'inactive'}>
                    <td className="strong">{b.name}</td>
                    <td>{TYPE_LABEL[b.type]}</td>
                    <td className="links">
                      {b.appDeeplinkTemplate && <code title={b.appDeeplinkTemplate}>app</code>}
                      {b.webUrlTemplate && <code title={b.webUrlTemplate}>web</code>}
                      {!b.appDeeplinkTemplate && !b.webUrlTemplate && <span className="muted">none</span>}
                    </td>
                    <td className="num">{b.rightsCount}</td>
                    <td>
                      <span className={`badge ${b.isActive ? 'ok' : 'off'}`}>{b.isActive ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="actions">
                      <button onClick={() => edit(b)}>Edit</button>
                      <button onClick={() => toggleActive(b)}>{b.isActive ? 'Deactivate' : 'Activate'}</button>
                      <button className="danger" onClick={() => remove(b)} disabled={b.rightsCount > 0} title={b.rightsCount > 0 ? 'Has rights; deactivate instead' : undefined}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form className="card form" onSubmit={submit} aria-label={editingId ? 'Edit broadcaster' : 'Add broadcaster'}>
        <h3>{editingId ? `Edit ${form.name || 'broadcaster'}` : 'Add a broadcaster'}</h3>
        <div className="grid">
          <label>
            Name
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={60} />
          </label>
          <label>
            Type
            <select value={form.type} onChange={(e) => set('type', e.target.value as BroadcasterType)}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            Web link
            <input value={form.webUrlTemplate ?? ''} onChange={(e) => set('webUrlTemplate', e.target.value)} placeholder="https://www.example.com/cricket/{providerMatchId}" />
          </label>
          <label className="wide">
            App deep link
            <input value={form.appDeeplinkTemplate ?? ''} onChange={(e) => set('appDeeplinkTemplate', e.target.value)} placeholder="exampleapp://match/{providerMatchId}" />
          </label>
          <label>
            Logo URL
            <input value={form.logoUrl ?? ''} onChange={(e) => set('logoUrl', e.target.value)} placeholder="https://…" />
          </label>
          <label>
            Affiliate URL
            <input value={form.affiliateUrl ?? ''} onChange={(e) => set('affiliateUrl', e.target.value)} placeholder="https://…" />
          </label>
        </div>
        <p className="hint">
          Links can use <code>{'{matchId}'}</code> and <code>{'{providerMatchId}'}</code>. Web links must start with https://. Leave a
          field empty if the broadcaster has no such link.
        </p>
        <div className="form-actions">
          {editingId && (
            <button type="button" onClick={reset}>
              Cancel
            </button>
          )}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add broadcaster'}
          </button>
        </div>
      </form>
    </section>
  );
}
