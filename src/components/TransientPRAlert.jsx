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

export default function TransientPRAlert({ event, preview, onDismiss }) {
  const [leaving, setLeaving] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    if (!event) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', onKey);
    const exitTimer = window.setTimeout(() => setLeaving(true), ALERT_DURATION);
    const dismissTimer = window.setTimeout(onDismiss, ALERT_DURATION + EXIT_DURATION);
    return () => {
      window.removeEventListener('keydown', onKey);
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
    >
      <div className="transient-alert__content">
        <div className="transient-alert__eyeline">
          <span className="transient-alert__team">{event.team || 'TEAM'}</span>
          <span className="transient-alert__label">{preview ? 'PREVIEW ALERT' : copy.label}</span>
        </div>
        <h2 className="transient-alert__headline">{copy.title}</h2>
        <div className="transient-alert__summary">
          <strong className="transient-alert__number">#{event.number ?? '—'}</strong>
          <p>{event.title || 'Pull request update'}</p>
        </div>
        <div className="transient-alert__meta">
          {event.avatarUrl && !avatarFailed ? (
            <img className="transient-alert__avatar" src={event.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} />
          ) : (
            <span className="transient-alert__avatar transient-alert__avatar--initial">{authorInitial}</span>
          )}
          <strong className="transient-alert__author">{event.author || 'Contributor'}</strong>
          <AnimatedCount className="transient-alert__additions" value={event.additions} prefix="+" />
          <AnimatedCount className="transient-alert__deletions" value={event.deletions} prefix="−" />
          <span className="transient-alert__files">{event.files ?? '—'} files</span>
        </div>
        <div className="transient-actions">
          {event.url && <a href={event.url} target="_blank" rel="noreferrer">Open pull request ↗</a>}
          <button onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}

function AnimatedCount({ value, prefix, className }) {
  const target = value == null || !Number.isFinite(Number(value)) ? null : Math.max(0, Number(value));
  const [count, setCount] = useState(() => target == null ? null : 0);

  useEffect(() => {
    if (target == null) {
      setCount(null);
      return undefined;
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setCount(Math.round(target));
      return undefined;
    }

    let start;
    let frame;
    const animate = (now) => {
      start ??= now;
      const progress = Math.min((now - start) / 900, 1);
      const eased = 1 - (1 - progress) ** 3;
      setCount(Math.round(target * eased));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  return <span className={className}>{prefix}{count == null ? '—' : count.toLocaleString()}</span>;
}
