import { Link } from 'react-router-dom';
import { api } from '../api';
import { shortDate } from '../format';
import { useAsync, useDocumentTitle } from '../hooks';
import { Empty, ErrorState, Skeleton } from '../components/bits';

export function TournamentsPage() {
  useDocumentTitle('Tournaments');
  const list = useAsync((s) => api.tournaments(s), []);
  return (
    <>
      <div className="page-intro">
        <h1>Tournaments</h1>
        <p className="muted">Current and upcoming series.</p>
      </div>
      {list.loading ? (
        <Skeleton rows={3} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : list.data!.length === 0 ? (
        <Empty>No current or upcoming tournaments.</Empty>
      ) : (
        <div className="rows">
          {list.data!.map((t) => (
            <Link key={t.id} to={`/tournaments/${t.id}`} className="tournament-row">
              <div>
                <div className="strong">{t.name}</div>
                <div className="muted small">
                  {t.format} · {shortDate(t.startDate)} – {shortDate(t.endDate)} · {t.matchCount} matches
                </div>
              </div>
              {t.liveCount > 0 && (
                <span className="status live">
                  <span className="pulse" aria-hidden="true" />
                  {t.liveCount} live
                </span>
              )}
              <span className="chevron" aria-hidden="true">
                ›
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
