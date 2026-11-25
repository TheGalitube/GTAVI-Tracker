import { Check, ExternalLink, GitPullRequest, Volume2, VolumeX, X } from 'lucide-react';

const previewEvent = {
  id: 'preview-2197', kind: 'opened', number: 2197,
  title: 'config: flag fidelityfx_dir in `victory config` policy check; fix example comment',
  team: 'Victory', author: 'romeawayfromhome-rgb', additions: 4, deletions: 1, files: 2,
};

export default function AlertDialog({ event, preview = false, soundEnabled, muteFutureAlerts, onSoundChange, onMuteFutureChange, onDismiss }) {
  if (!event) return null;
  const type = event.kind === 'merged' ? 'MERGED' : event.kind === 'closed' ? 'CLOSED' : 'NEW PULL REQUEST';
  const title = event.kind === 'merged' ? 'MERGED' : event.kind === 'closed' ? 'CLOSED' : 'NEW PR';
  const active = event.url;
  const content = event === true ? previewEvent : event;

  return (
    <div className="alert-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onDismiss()}>
      <section className="alert-dialog" role="dialog" aria-modal="true" aria-labelledby="alert-title">
        <button className="alert-close" aria-label="Dismiss alert" onClick={onDismiss}><X size={20} /></button>
        <div className="alert-kind"><GitPullRequest size={17} /><strong>{content.team}</strong><span>•</span><span>{preview ? 'PREVIEW ALERT' : type}</span></div>
        <div className="alert-title-wrap"><h2 id="alert-title">{title}</h2><strong className="alert-number">#{content.number ?? '—'}</strong></div>
        <h3 className="alert-description">{content.title}</h3>
        <div className="alert-meta">
          <span className="avatar-mark">{content.author?.slice(0, 1).toUpperCase() || 'C'}</span>
          <strong>{content.author || 'Contributor'}</strong>
          <span className="change additions">+{content.additions ?? '—'}</span>
          <span className="change deletions">−{content.deletions ?? '—'}</span>
          <span>{content.files ?? '—'} files</span>
        </div>
        <div className="alert-actions">
          <a className={`action-primary ${active ? '' : 'disabled'}`} href={active || undefined} target={active ? '_blank' : undefined} rel="noreferrer" aria-disabled={!active}>
            View pull request <ExternalLink size={18} />
          </a>
          <button className="action-secondary" onClick={onDismiss}>Dismiss</button>
        </div>
        <footer className="alert-options">
          <button className="sound-switch" onClick={() => onSoundChange(!soundEnabled)} aria-pressed={soundEnabled}>
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}<span>Sound</span><i className={soundEnabled ? 'on' : ''}><b /></i>
          </button>
          <span className="alert-preview-note">{preview ? 'Preview only — live alerts wait for feed connection' : 'Dismiss future alerts'}</span>
          <button className={`option-check ${muteFutureAlerts ? 'checked' : ''}`} aria-label="Mute future alerts" aria-pressed={muteFutureAlerts} onClick={() => onMuteFutureChange(!muteFutureAlerts)}>{muteFutureAlerts && <Check size={13} />}</button>
        </footer>
      </section>
    </div>
  );
}
