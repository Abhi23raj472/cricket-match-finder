import { useEffect, useState } from 'react';
import type { RightsGapDto } from '@cmf/shared';
import { api, formatDateTime } from '../api';

const WINDOWS = [7, 14, 30] as const;

export function GapsPage({ onFix }: { onFix: () => void }) {
  const [days, setDays] = useState<number>(14);
  const [gaps, setGaps] = useState<RightsGapDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGaps(null);
    api.gaps(days).then(setGaps).catch((e: Error) => setError(e.message));
  }, [days]);

  return (
    <section className="page">
      <div className="page-head">
        <h2>Gaps</h2>
        <p className="muted">Upcoming and live matches that would show no way to watch in a country. The server also logs these daily at 09:00 IST.</p>
      </div>

      <div className="filters">
        <label>
          Next
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {WINDOWS.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="card">
        {gaps === null ? (
          <p className="muted">Checking…</p>
        ) : gaps.length === 0 ? (
          <p className="notice">Every match in the next {days} days has at least one broadcaster in every country you cover.</p>
        ) : (
          <>
            <p className="warn">
              {gaps.length} gap{gaps.length === 1 ? '' : 's'} found.{' '}
              <button className="link" onClick={onFix}>
                Add rights
              </button>
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Starts</th>
                    <th>Match</th>
                    <th>Tournament</th>
                    <th>Country</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((g) => (
                    <tr key={`${g.match.id}-${g.regionCode}`}>
                      <td className="small">{formatDateTime(g.match.startTimeUtc)}</td>
                      <td className="strong">{g.match.label}</td>
                      <td>{g.match.tournamentName}</td>
                      <td>{g.regionCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
