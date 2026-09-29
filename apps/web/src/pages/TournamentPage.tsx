import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { groupByDay, shortDate } from '../format';
import { useAsync, useDocumentTitle } from '../hooks';
import { Empty, ErrorState, Skeleton, TeamBadge } from '../components/bits';
import { MatchRow } from '../components/MatchCards';

type Tab = 'fixtures' | 'table' | 'results';

export function TournamentPage() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<Tab>('fixtures');
  const detail = useAsync((s) => api.tournament(id, s), [id]);
  const matches = useAsync((s) => api.matches({ tournament: id, pageSize: 100 }, s), [id], 30_000);
  useDocumentTitle(detail.data?.name);

  if (detail.error) return <ErrorState message={detail.error} onRetry={detail.reload} />;
  const t = detail.data;
  const all = matches.data?.items ?? [];
  const fixtures = all.filter((m) => m.status === 'live' || m.status === 'upcoming');
  const results = all.filter((m) => m.status === 'completed' || m.status === 'abandoned').reverse();

  return (
    <>
      <nav className="crumbs small" aria-label="Breadcrumb">
        <Link to="/tournaments">Tournaments</Link>
      </nav>
      <div className="page-intro">
        <h1>{t?.name ?? ' '}</h1>
        {t && (
          <p className="muted">
            {t.format} · {shortDate(t.startDate)} – {shortDate(t.endDate)}
          </p>
        )}
      </div>

      <div className="tabs big" role="tablist" aria-label="Tournament sections">
        {(
          [
            ['fixtures', 'Fixtures'],
            ['table', 'Points table'],
            ['results', 'Results'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'table' ? (
        !t ? (
          <Skeleton rows={4} />
        ) : (
          <div className="panel">
            <div className="table-scroll">
              <table className="standings">
                <thead>
                  <tr>
                    <th className="left">Team</th>
                    <th>P</th>
                    <th>W</th>
                    <th>L</th>
                    <th>NR</th>
                    <th>Pts</th>
                    <th>NRR</th>
                  </tr>
                </thead>
                <tbody>
                  {t.standings.map((r, i) => (
                    <tr key={r.team.id}>
                      <td className="left">
                        <span className="team-cell">
                          <span className="pos">{i + 1}</span>
                          <TeamBadge team={r.team} size="sm" />
                          <span className="strong">{r.team.name}</span>
                        </span>
                      </td>
                      <td>{r.played}</td>
                      <td>{r.won}</td>
                      <td>{r.lost}</td>
                      <td>{r.tied + r.noResult}</td>
                      <td className="strong">{r.points}</td>
                      <td>{(r.netRunRate >= 0 ? '+' : '') + r.netRunRate.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="fine-print">Win 2 points, tie or no result 1. Teams level on points are ranked by net run rate.</p>
          </div>
        )
      ) : matches.loading ? (
        <Skeleton rows={4} />
      ) : matches.error ? (
        <ErrorState message={matches.error} onRetry={matches.reload} />
      ) : tab === 'fixtures' ? (
        fixtures.length === 0 ? (
          <Empty>No fixtures left in this tournament.</Empty>
        ) : (
          groupByDay(fixtures, (m) => m.startTimeUtc).map(([day, items]) => (
            <div key={day} className="day-group">
              <h3 className="day-label">{day}</h3>
              <div className="rows">
                {items.map((m) => (
                  <MatchRow key={m.id} match={m} showTournament={false} />
                ))}
              </div>
            </div>
          ))
        )
      ) : results.length === 0 ? (
        <Empty>No results yet.</Empty>
      ) : (
        <div className="rows">
          {results.map((m) => (
            <MatchRow key={m.id} match={m} showTournament={false} />
          ))}
        </div>
      )}
    </>
  );
}
