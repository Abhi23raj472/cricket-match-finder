import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { chaseText, runRate, scoreText, sortWatchOptions, type LiveScoreDto, type TeamDto } from '@cmf/shared';
import { api, subscribeLive } from '../api';
import { dayLabel, timeLabel } from '../format';
import { useAsync, useDocumentTitle } from '../hooks';
import { usePrefs } from '../prefs';
import { ErrorState, Skeleton, StatusLabel, TeamBadge } from '../components/bits';
import { Scorecard } from '../components/Scorecard';
import { WatchPanel } from '../components/WatchPanel';

export function MatchPage() {
  const { id = '' } = useParams();
  const prefs = usePrefs();
  const match = useAsync((s) => api.match(id, s), [id, prefs.region]);
  const m = match.data;
  const [live, setLive] = useState<LiveScoreDto | null>(null);
  const [connected, setConnected] = useState(false);
  const [inningsIdx, setInningsIdx] = useState<number | null>(null);

  useDocumentTitle(m ? `${m.homeTeam.shortCode} v ${m.awayTeam.shortCode}` : undefined);

  useEffect(() => {
    setLive(m?.live ?? null);
    if (!m || (m.status !== 'live' && m.status !== 'upcoming')) return;
    return subscribeLive(m.id, setLive, setConnected);
  }, [m]);

  const options = useMemo(() => sortWatchOptions(m?.watchOptions ?? [], prefs.subscriptions), [m?.watchOptions, prefs.subscriptions]);

  if (!m) {
    return match.error ? (
      <ErrorState message={match.error} onRetry={match.reload} />
    ) : (
      <div className="match-layout">
        <Skeleton rows={1} tall />
        <Skeleton rows={4} />
      </div>
    );
  }

  const status = live?.status ?? m.status;
  const innings = live?.innings ?? [];
  const teams: TeamDto[] = [m.homeTeam, m.awayTeam];
  const nameOf = (tid: string) => teams.find((t) => t.id === tid)?.name ?? '';
  const scoreOf = (team: TeamDto) => innings.filter((i) => i.battingTeamId === team.id).at(-1);
  const current = innings.at(-1);
  const shown = inningsIdx ?? innings.length - 1;
  const chase = status === 'live' ? chaseText(innings, nameOf) : null;
  const final = status === 'completed' || status === 'abandoned';

  return (
    <>
      <nav className="crumbs small" aria-label="Breadcrumb">
        <Link to="/">Matches</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/tournaments/${m.tournament.id}`}>{m.tournament.name}</Link>
      </nav>

      <div className="match-layout">
        <div className="match-main">
          <section className="scoreboard" aria-label="Score">
            <div className="scoreboard-top">
              <span className="muted small">
                {[m.matchNo, `${m.venue.name}, ${m.venue.city}`].filter(Boolean).join(' · ')}
              </span>
              <StatusLabel status={status} />
            </div>
            {teams.map((team) => {
              const sc = scoreOf(team);
              const batting = status === 'live' && current?.battingTeamId === team.id;
              return (
                <div key={team.id} className={`score-line ${batting ? 'batting' : ''}`}>
                  <TeamBadge team={team} size="lg" />
                  <span className="score-team">{team.name}</span>
                  <span className="score-num">{sc ? scoreText(sc) : ''}</span>
                </div>
              );
            })}
            <p className={`scoreboard-note ${final ? 'result' : ''}`}>
              {final
                ? (m.resultText ?? 'No result')
                : chase ??
                  (status === 'upcoming'
                    ? `Starts ${dayLabel(m.startTimeUtc).toLowerCase() === 'today' ? 'today' : dayLabel(m.startTimeUtc)} at ${timeLabel(m.startTimeUtc)}`
                    : live?.tossText ?? '')}
            </p>
            {status === 'live' && current && (
              <p className="muted small">
                Run rate {runRate(current.runs, current.overs)}
                {connected ? ' · Live updates on' : ''}
              </p>
            )}
          </section>

          <div className="watch-mobile">
            <WatchPanel options={options} region={prefs.region} />
          </div>

          {status === 'live' && live && (live.currentBatters.length > 0 || live.currentBowler) && (
            <section className="panel" aria-labelledby="crease-title">
              <h2 id="crease-title">At the crease</h2>
              <div className="crease">
                {live.currentBatters.map((b, i) => (
                  <div key={`${b.name}-${i}`} className="crease-line">
                    <span>
                      {b.name}
                      {i === 0 && <span className="muted"> · on strike</span>}
                    </span>
                    <span className="num strong">
                      {b.runs} <span className="muted">({b.balls})</span>
                    </span>
                  </div>
                ))}
                {live.currentBowler && (
                  <div className="crease-line muted">
                    <span>{live.currentBowler.name}</span>
                    <span className="num">
                      {live.currentBowler.wickets}-{live.currentBowler.runs} ({live.currentBowler.overs})
                    </span>
                  </div>
                )}
              </div>
              {live.lastSixBalls.length > 0 && (
                <div className="balls" aria-label={`Last balls: ${live.lastSixBalls.join(', ')}`}>
                  <span className="muted small">Recent</span>
                  {live.lastSixBalls.map((b, i) => (
                    <span key={i} className={`ball ${b === 'W' ? 'wicket' : b === '4' || b === '6' ? 'boundary' : ''}`}>
                      {b === '0' ? '·' : b}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {innings.length > 0 && (
            <section className="panel" aria-labelledby="scorecard-title">
              <div className="panel-head">
                <h2 id="scorecard-title">Scorecard</h2>
                {innings.length > 1 && (
                  <div className="tabs" role="tablist" aria-label="Innings">
                    {innings.map((inn, i) => (
                      <button key={i} role="tab" aria-selected={shown === i} className={shown === i ? 'active' : ''} onClick={() => setInningsIdx(i)}>
                        {teams.find((t) => t.id === inn.battingTeamId)?.shortCode ?? `Inn ${i + 1}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Scorecard innings={innings[shown]} team={teams.find((t) => t.id === innings[shown].battingTeamId)} />
            </section>
          )}

          {live && live.commentary.length > 0 && (
            <section className="panel" aria-labelledby="comm-title">
              <h2 id="comm-title">Commentary</h2>
              <ol className="commentary">
                {live.commentary.slice(0, 24).map((c, i) => (
                  <li key={`${c.over}-${i}`}>
                    <span className="over num">{c.over}</span>
                    <span>{c.text}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <div className="match-aside">
          <WatchPanel options={options} region={prefs.region} />
        </div>
      </div>
    </>
  );
}
