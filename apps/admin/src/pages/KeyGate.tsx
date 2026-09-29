import { useState, type FormEvent } from 'react';
import { ApiError, adminKey, api } from '../api';

export function KeyGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.checkKey(key.trim());
      adminKey.set(key.trim());
      onUnlocked();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'That key is not correct.' : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="gate">
      <form className="card gate-card" onSubmit={submit}>
        <h1>Cricket Match Finder</h1>
        <p className="muted">Admin panel. Enter the admin key set as ADMIN_API_KEY on the server.</p>
        <label>
          Admin key
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoFocus required autoComplete="current-password" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="primary" disabled={busy || !key.trim()}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </main>
  );
}
