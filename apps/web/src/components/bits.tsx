import type { CSSProperties, ReactNode } from 'react';
import type { MatchStatus, TeamDto } from '@cmf/shared';

/** Stable soft colour per team, derived from its id. */
export function teamHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function TeamBadge({ team, size = 'md' }: { team: Pick<TeamDto, 'id' | 'shortCode' | 'name'>; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`team-badge ${size}`} style={{ '--h': teamHue(team.id) } as CSSProperties} aria-hidden="true">
      {team.shortCode.slice(0, 3)}
    </span>
  );
}

export function StatusLabel({ status }: { status: MatchStatus }) {
  if (status === 'live') {
    return (
      <span className="status live">
        <span className="pulse" aria-hidden="true" />
        Live
      </span>
    );
  }
  const text = status === 'completed' ? 'Result' : status === 'abandoned' ? 'Abandoned' : 'Upcoming';
  return <span className={`status ${status}`}>{text}</span>;
}

export function Section({ title, action, children, id }: { title: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section-head">
        <h2 id={id}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="btn ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Skeleton({ rows = 3, tall = false }: { rows?: number; tall?: boolean }) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`skeleton ${tall ? 'tall' : ''}`} />
      ))}
    </div>
  );
}
