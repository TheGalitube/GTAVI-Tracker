import { useState } from 'react';
import { GitPullRequest, CircleCheck, CircleDot, CircleX, ExternalLink } from 'lucide-react';

const statusIcon = { opened: CircleDot, merged: CircleCheck, closed: CircleX };

export default function LiveFeed({ events = [] }) {
  const [filter, setFilter] = useState('all');
  const visibleEvents = (filter === 'all' ? events : events.filter((event) => event.kind === filter)).slice(0, 6);
  return (
    <section className="feed-panel">
      <header className="panel-heading">
        <GitPullRequest size={17} /><h2>Live pull request feed</h2>
        <select className="feed-filter" aria-label="Filter pull request activity" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All activity</option>
          <option value="opened">Opened</option>
          <option value="merged">Merged</option>
          <option value="closed">Closed</option>
        </select>
      </header>
      <div className="feed-items">
        {visibleEvents.map((event) => {
          const Status = statusIcon[event.kind] || CircleDot;
          const row = <>
            <Status className={`feed-status ${event.kind}`} size={15} />
            <strong className="feed-number">#{event.number ?? '—'}</strong>
            <div className="feed-copy"><span className="feed-title">{event.title}</span><div className="feed-meta"><span className="feed-team" style={{ '--team-color': event.teamColor }}>{event.team}</span><span>{event.kind}</span><span>{relativeTime(event.timestamp)}</span></div></div>
            <span className={`status-tag ${event.kind}`}>{event.kind}</span>
            {event.url && <ExternalLink className="feed-link" size={14} />}
          </>;
          return event.url
            ? <a className="feed-row" key={event.id} href={event.url} target="_blank" rel="noreferrer">{row}</a>
            : <div className="feed-row" key={event.id}>{row}</div>;
        })}
        {visibleEvents.length === 0 && <div className="empty-feed" role="status">
          {filter === 'all' ? 'Recent pull request activity will appear here.' : `No recent ${filter} pull requests.`}
        </div>}
      </div>
    </section>
  );
}

function relativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
