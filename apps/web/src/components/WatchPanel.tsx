import { Link } from 'react-router-dom';
import { REGIONS, languageName, type WatchOptionDto } from '@cmf/shared';

const TYPE: Record<WatchOptionDto['type'], string> = { OTT: 'Streaming', TV: 'TV channel', FREE: 'Free-to-air' };

/** "Where to watch" for one match. Links open the broadcaster's own site in a new tab. */
export function WatchPanel({ options, region }: { options: WatchOptionDto[]; region: string }) {
  const country = REGIONS.find((r) => r.code === region)?.name ?? region;
  return (
    <aside className="watch-panel" aria-labelledby="watch-title">
      <h2 id="watch-title">Where to watch</h2>
      <p className="muted small">
        Official broadcasters in {country}.{' '}
        <Link to="/preferences" className="link">
          Change
        </Link>
      </p>

      {options.length === 0 ? (
        <p className="empty">We don't know of an official broadcaster for this match in {country} yet.</p>
      ) : (
        <ul className="watch-list">
          {options.map((o) => {
            const url = o.webUrl ?? o.affiliateUrl;
            return (
              <li key={`${o.broadcasterId}-${o.language}`} className={`watch-option ${o.isSubscribed ? 'mine' : ''}`}>
                <div className="watch-info">
                  <span className="watch-name">{o.name}</span>
                  <span className="muted small">
                    {TYPE[o.type]} · {languageName(o.language)}
                  </span>
                  {(o.isSubscribed || o.isFree) && (
                    <span className="tags">
                      {o.isSubscribed && <span className="tag mine">Your subscription</span>}
                      {o.isFree && <span className="tag free">Free</span>}
                    </span>
                  )}
                </div>
                {url ? (
                  <a className={`btn ${o.isSubscribed ? 'primary' : 'ghost'}`} href={url} target="_blank" rel="noopener noreferrer">
                    Watch <span aria-hidden="true">↗</span>
                    <span className="sr-only"> on {o.name} (opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="muted small">On TV</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="fine-print">You'll sign in on the broadcaster's own site. We never ask for your streaming passwords.</p>
    </aside>
  );
}
