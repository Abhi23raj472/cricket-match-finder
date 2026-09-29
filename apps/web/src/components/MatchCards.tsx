import { Link } from 'react-router-dom';
import { scoreText, teamScore, type MatchSummaryDto, type TeamDto } from '@cmf/shared';
import { shortDayLabel, timeLabel } from '../format';
import { StatusLabel, TeamBadge } from './bits';

function TeamLine({ match, team }: { match: MatchSummaryDto; team: TeamDto }) {
  const sc = teamScore(match, team);
  const batting = match.status === 'live' && match.scores.at(-1)?.teamId === team.id;
  return (
    <div className={`team-line ${batting ? 'batting' : ''}`}>
      <TeamBadge team={team} />
      <span className="team-name">{team.name}</span>
      <span className="team-score">
        {sc ? scoreText(sc) : match.status === 'live' ? <span className="muted">Yet to bat</span> : ''}
      </span>
    </div>
  );
}

/** Large card, used for live matches. */
export function MatchCard({ match }: { match: MatchSummaryDto }) {
  return (
    <Link to={`/match/${match.id}`} className="match-card" aria-label={`${match.homeTeam.name} v ${match.awayTeam.name}, ${match.status}`}>
      <div className="match-card-top">
        <span className="muted small truncate">
          {[match.matchNo, match.tournament.name].filter(Boolean).join(' · ')}
        </span>
        <StatusLabel status={match.status} />
      </div>
      <TeamLine match={match} team={match.homeTeam} />
      <TeamLine match={match} team={match.awayTeam} />
      <div className="match-card-foot muted small">
        {match.status === 'completed' || match.status === 'abandoned' ? (
          <span className="result">{match.resultText ?? 'No result'}</span>
        ) : (
          <span>
            {match.venue.city}
            {match.status === 'upcoming' ? ` · ${timeLabel(match.startTimeUtc)}` : ''}
          </span>
        )}
        <span className="card-cta">Scorecard & where to watch →</span>
      </div>
    </Link>
  );
}

/** Compact row, used for fixtures and results lists. */
export function MatchRow({ match, showTournament = true }: { match: MatchSummaryDto; showTournament?: boolean }) {
  const done = match.status === 'completed' || match.status === 'abandoned';
  const home = teamScore(match, match.homeTeam);
  const away = teamScore(match, match.awayTeam);
  return (
    <Link to={`/match/${match.id}`} className="match-row" aria-label={`${match.homeTeam.name} v ${match.awayTeam.name}, ${match.status}`}>
      <div className="match-row-when">
        {match.status === 'live' ? (
          <StatusLabel status="live" />
        ) : done ? (
          <span className="date">{shortDayLabel(match.startTimeUtc)}</span>
        ) : (
          <span className="time">{timeLabel(match.startTimeUtc)}</span>
        )}
      </div>
      <div className="match-row-teams">
        <div className="row-team">
          <TeamBadge team={match.homeTeam} size="sm" />
          <span className="team-name">{match.homeTeam.name}</span>
          {home && <span className="row-score">{scoreText(home)}</span>}
        </div>
        <div className="row-team">
          <TeamBadge team={match.awayTeam} size="sm" />
          <span className="team-name">{match.awayTeam.name}</span>
          {away && <span className="row-score">{scoreText(away)}</span>}
        </div>
      </div>
      <div className="match-row-meta">
        {done ? <span className="result">{match.resultText ?? 'No result'}</span> : <span>{match.venue.city}</span>}
        {showTournament && <span className="muted small truncate">{[match.matchNo, match.tournament.name].filter(Boolean).join(' · ')}</span>}
      </div>
      <span className="chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
