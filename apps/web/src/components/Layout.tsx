import { NavLink, Outlet } from 'react-router-dom';
import { REGIONS } from '@cmf/shared';
import { setPrefs, usePrefs } from '../prefs';
import { zoneAbbrev } from '../format';
import { DEMO } from '../api';

export function Layout() {
  const prefs = usePrefs();
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {DEMO && (
        <div className="demo-banner" role="note">
          <strong>Demo</strong> · Sample matches simulated in your browser, not real fixtures or scores. Broadcaster rights are examples for India.
        </div>
      )}
      <header className="site-header">
        <div className="container header-inner">
          <NavLink to="/" className="wordmark" aria-label="Match Finder home">
            <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
              <circle cx="16" cy="16" r="14" fill="var(--accent)" />
              <path d="M9 16c3-4 11-4 14 0M9 16c3 4 11 4 14 0" stroke="#fff" strokeWidth="1.6" fill="none" />
            </svg>
            Match Finder
          </NavLink>
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end>
              Matches
            </NavLink>
            <NavLink to="/tournaments">Tournaments</NavLink>
            <NavLink to="/preferences">Preferences</NavLink>
          </nav>
          <label className="country">
            <span className="sr-only">Country</span>
            <select value={prefs.region} onChange={(e) => setPrefs({ region: e.target.value })}>
              {REGIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <main id="main" className="container main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-inner muted small">
          <span>Times in {zoneAbbrev()}. {DEMO ? 'Demo data, simulated in your browser.' : 'Scores from a licensed data provider.'}</span>
          <span>We link to official broadcasters only.</span>
        </div>
      </footer>
    </div>
  );
}
