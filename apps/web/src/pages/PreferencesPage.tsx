import { REGIONS } from '@cmf/shared';
import { api } from '../api';
import { useAsync, useDocumentTitle } from '../hooks';
import { setPrefs, usePrefs } from '../prefs';
import { ErrorState, Skeleton } from '../components/bits';

export function PreferencesPage() {
  useDocumentTitle('Preferences');
  const prefs = usePrefs();
  const broadcasters = useAsync((s) => api.broadcasters(s), []);
  const toggle = (id: string) =>
    setPrefs({ subscriptions: prefs.subscriptions.includes(id) ? prefs.subscriptions.filter((x) => x !== id) : [...prefs.subscriptions, id] });

  return (
    <>
      <div className="page-intro">
        <h1>Preferences</h1>
        <p className="muted">Saved in this browser. We use them to show the right broadcasters and put yours first.</p>
      </div>

      <section className="panel narrow" aria-labelledby="country-title">
        <h2 id="country-title">Your country</h2>
        <p className="muted small">Broadcast rights differ by country.</p>
        <select className="select" value={prefs.region} onChange={(e) => setPrefs({ region: e.target.value })} aria-labelledby="country-title">
          {REGIONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
      </section>

      <section className="panel narrow" aria-labelledby="subs-title">
        <h2 id="subs-title">Apps you already pay for</h2>
        <p className="muted small">Matches you can watch with these are shown first.</p>
        {broadcasters.loading ? (
          <Skeleton rows={3} />
        ) : broadcasters.error ? (
          <ErrorState message={broadcasters.error} onRetry={broadcasters.reload} />
        ) : (
          <ul className="checks">
            {broadcasters.data!.map((b) => (
              <li key={b.id}>
                <label>
                  <input type="checkbox" checked={prefs.subscriptions.includes(b.id)} onChange={() => toggle(b.id)} />
                  <span>{b.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
