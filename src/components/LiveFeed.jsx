import { useState } from 'react';
import { GitPullRequest, CircleCheck, CircleDot, CircleX, ExternalLink } from 'lucide-react';
import { lifecycleEventKey } from '../lib/portwatch.js';

const statusIcon = { opened: CircleDot, merged: CircleCheck, closed: CircleX };

export default function LiveFeed({ events = [] }) {
  const [filter, setFilter] = useState('all');
  const [team, setTeam] = useState('');
  const [limit, setLimit] = useState(6);
  const teams = [...new Set(events.map((event) => event.team))].sort();
  const selectedTeam = teams.includes(team) ? team : '';
  const matches = events.filter((event) =>
    (filter === 'all' || event.kind === filter) && (!selectedTeam || event.team === selectedTeam)
  );
  const visibleEvents = matches.slice(0, limit);
  const resetFilters = () => {
    setTeam('');
    setFilter('all');
    setLimit(6);
  };
  return (
    <section className="feed-panel">
      <header className="panel-heading">
        <GitPullRequest size={17} /><h2>Live pull request feed</h2>
      </header>
      <div className="feed-controls">
        <select className="feed-filter" aria-label="Filter activity by team" value={selectedTeam} onChange={(event) => { setTeam(event.target.value); setLimit(6); }}>
          <option value="">All teams</option>
          {teams.map((name) => <option key={name}>{name}</option>)}
        </select>
        <select className="feed-filter" aria-label="Filter pull request activity" value={filter} onChange={(event) => { setFilter(event.target.value); setLimit(6); }}>
          <option value="all">All activity</option>
          <option value="opened">Opened</option>
          <option value="merged">Merged</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div className="feed-items">
        {visibleEvents.map((event) => {
          const Status = statusIcon[event.kind] || CircleDot;
          const row = <>
            <Status className={`feed-status ${event.kind}`} size={15} />
            <strong className="feed-number">#{event.number ?? '—'}</strong>
            <div className="feed-copy"><span className="feed-title">{event.title}</span><div className="feed-meta"><span className="feed-team" style={{ '--team-color': event.teamColor }}>{event.team}</span><span>{event.kind}</span><EventTime value={event.timestamp} /></div></div>
            <span className={`status-tag ${event.kind}`}>{event.kind}</span>
            {event.url && <ExternalLink className="feed-link" size={14} />}
          </>;
          return event.url
            ? <a className="feed-row" key={lifecycleEventKey(event)} href={event.url} target="_blank" rel="noreferrer">{row}</a>
            : <div className="feed-row" key={lifecycleEventKey(event)}>{row}</div>;
        })}
        {visibleEvents.length === 0 && <div className="empty-feed" role="status">
          {!selectedTeam && filter === 'all' ? 'Recent pull request activity will appear here.' : <>
            No matching pull requests. <button className="text-control" onClick={resetFilters}>Clear filters</button>
          </>}
        </div>}
      </div>
      {matches.length > 6 && <div className="feed-pages">
        {limit < matches.length && <button className="text-control" onClick={() => setLimit(limit + 6)}>Show more ({matches.length - visibleEvents.length})</button>}
        {limit > 6 && <button className="text-control" onClick={() => setLimit(6)}>Show fewer</button>}
      </div>}
    </section>
  );
}

function EventTime({ value }) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return <span>Time unknown</span>;
  return <time dateTime={date.toISOString()} title={date.toLocaleString()}>{relativeTime(date.getTime())}</time>;
}

function relativeTime(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
