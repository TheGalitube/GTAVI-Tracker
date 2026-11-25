import { useEffect, useState } from 'react';

const ALERT_DURATION = 6_200;
const EXIT_DURATION = 650;

const alertCopy = {
  opened: { label: 'NEW PULL REQUEST', title: 'NEW PR' },
  closed: { label: 'PULL REQUEST CLOSED', title: 'CLOSED' },
  merged: { label: 'PULL REQUEST MERGED', title: 'MERGED' },
};

const accents = {
  opened: '#ad86ff',
  closed: '#ff858e',
  merged: '#48dca1',
};

export default function TransientPRAlert({ event, onDismiss }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!event) return undefined;
    const exitTimer = window.setTimeout(() => setLeaving(true), ALERT_DURATION);
    const dismissTimer = window.setTimeout(onDismiss, ALERT_DURATION + EXIT_DURATION);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [event?.id, event?.kind, onDismiss]);

  if (!event) return null;

  const copy = alertCopy[event.kind] ?? alertCopy.opened;
  const accent = accents[event.kind] ?? accents.opened;
  const authorInitial = event.author?.slice(0, 1).toUpperCase() || 'C';

  return (
    <div
      className={`transient-alert ${leaving ? 'is-leaving' : ''}`}
      style={{ '--alert-accent': accent, '--alert-team': event.teamColor || '#35c58a' }}
      role="status"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="transient-alert__content">
        <div className="transient-alert__eyeline">
          <span className="transient-alert__team">{event.team || 'TEAM'}</span>
          <span className="transient-alert__label">{copy.label}</span>
        </div>
        <h2 className="transient-alert__headline">{copy.title}</h2>
        <div className="transient-alert__summary">
          <strong className="transient-alert__number">#{event.number ?? '—'}</strong>
          <p>{event.title || 'Pull request update'}</p>
        </div>
        <div className="transient-alert__meta">
          {event.avatarUrl ? (
            <img className="transient-alert__avatar" src={event.avatarUrl} alt="" />
          ) : (
            <span className="transient-alert__avatar transient-alert__avatar--initial">{authorInitial}</span>
          )}
          <strong className="transient-alert__author">{event.author || 'Contributor'}</strong>
          <span className="transient-alert__additions">+{event.additions ?? '—'}</span>
          <span className="transient-alert__deletions">−{event.deletions ?? '—'}</span>
          <span className="transient-alert__files">{event.files ?? '—'} files</span>
        </div>
      </div>
    </div>
  );
}
