import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { groupByDay } from '../format';
import { useAsync, useDocumentTitle } from '../hooks';
import { usePrefs } from '../prefs';
import { Empty, ErrorState, Section, Skeleton } from '../components/bits';
import { MatchCard, MatchRow } from '../components/MatchCards';

const REFRESH_MS = 30_000;

export function HomePage() {
  useDocumentTitle(undefined);
  const { region } = usePrefs();
  const [tournament, setTournament] = useState<string | undefined>();
  const tournaments = useAsync((s) => api.tournaments(s), [region]);
  const live = useAsync((s) => api.matches({ status: 'live', tournament, pageSize: 20 }, s), [tournament, region], REFRESH_MS);
  const upcoming = useAsync((s) => api.matches({ status: 'upcoming', tournament, pageSize: 12 }, s), [tournament, region]);
  const results = useAsync((s) => api.matches({ status: 'completed', tournament, pageSize: 6 }, s), [tournament, region], REFRESH_MS);

  const liveItems = live.data?.items ?? [];

  return (
    <>
      <div className="page-intro">
        <h1>Every match. Where to watch it.</h1>
        <p className="muted">Live scores and the official place to stream or watch each game, in one feed.</p>
      </div>

      {tournaments.data && tournaments.data.length > 0 && (
        <div className="chips" role="group" aria-label="Filter by tournament">
          <button className={`chip ${!tournament ? 'active' : ''}`} aria-pressed={!tournament} onClick={() => setTournament(undefined)}>
            All matches
          </button>
          {tournaments.data.map((t) => (
            <button key={t.id} className={`chip ${tournament === t.id ? 'active' : ''}`} aria-pressed={tournament === t.id} onClick={() => setTournament(tournament === t.id ? undefined : t.id)}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      <Section title="Live now" id="live-title">
        {live.loading ? (
          <Skeleton rows={2} tall />
        ) : live.error ? (
          <ErrorState message={live.error} onRetry={live.reload} />
        ) : liveItems.length === 0 ? (
          <Empty>No matches are live right now. The next ones are below.</Empty>
        ) : (
          <div className="card-grid">
            {liveItems.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Coming up" id="upcoming-title">
        {upcoming.loading ? (
          <Skeleton rows={3} />
        ) : upcoming.error ? (
          <ErrorState message={upcoming.error} onRetry={upcoming.reload} />
        ) : (upcoming.data?.items.length ?? 0) === 0 ? (
          <Empty>No upcoming matches scheduled.</Empty>
        ) : (
          groupByDay(upcoming.data!.items, (m) => m.startTimeUtc).map(([day, items]) => (
            <div key={day} className="day-group">
              <h3 className="day-label">{day}</h3>
              <div className="rows">
                {items.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            </div>
          ))
        )}
      </Section>

      <Section title="Recent results" id="results-title" action={<Link to="/tournaments" className="link small">All tournaments →</Link>}>
        {results.loading ? (
          <Skeleton rows={3} />
        ) : results.error ? (
          <ErrorState message={results.error} onRetry={results.reload} />
        ) : (results.data?.items.length ?? 0) === 0 ? (
          <Empty>No results yet.</Empty>
        ) : (
          <div className="rows">
            {results.data!.items.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
