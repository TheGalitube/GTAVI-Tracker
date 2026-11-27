import { useState } from 'react';
import { ChevronLeft, ChevronRight, Github, Pause, Play } from 'lucide-react';

export default function CurrentPullRequest({ pullRequests }) {
  const [selectedId, setSelectedId] = useState(null);
  const [paused, setPaused] = useState(false);
  const index = Math.max(0, pullRequests.findIndex((pr) => pr.id === selectedId));
  const currentPullRequest = pullRequests[index];
  const currentId = currentPullRequest?.id ?? null;
  if (selectedId !== currentId) setSelectedId(currentId);

  const move = (offset) => {
    const next = (index + offset + pullRequests.length) % pullRequests.length;
    setSelectedId(pullRequests[next].id);
  };

  return (
    <section className="current-pr" aria-label="Current pull request">
      <div className="current-toolbar">
        <span className="current-label">CURRENT PULL REQUEST</span>
        {pullRequests.length > 1 && <div className="current-controls">
          <span>{index + 1} / {pullRequests.length}</span>
          <button aria-label="Previous pull request" onClick={() => move(-1)}><ChevronLeft size={15} /></button>
          <button aria-label="Pause automatic rotation" aria-pressed={paused} title={paused ? 'Resume rotation' : 'Pause rotation'} onClick={() => setPaused(!paused)}>
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button aria-label="Next pull request" onClick={() => move(1)}><ChevronRight size={15} /></button>
        </div>}
      </div>
      {currentPullRequest ? <div className={pullRequests.length > 1 ? "current-pr__entry" : undefined} key={currentPullRequest.id}>
        <a className="current-title" href={currentPullRequest.url || undefined} target={currentPullRequest.url ? '_blank' : undefined} rel="noreferrer"><Github size={23} /><strong>#{currentPullRequest.number}</strong><span>{currentPullRequest.title}</span></a>
        <div className="current-meta"><span className="team-pill">{currentPullRequest.team}</span><span>{currentPullRequest.author}</span><span className="change additions">+{currentPullRequest.additions ?? '—'}</span><span className="change deletions">−{currentPullRequest.deletions ?? '—'}</span><span>{currentPullRequest.files ?? '—'} files</span><span>{currentPullRequest.commits ?? '—'} commits</span></div>
      </div> : <div className="current-empty">The latest active pull request will appear here.</div>}
      {pullRequests.length > 1 && (
        <div className="current-pr__timer" aria-hidden="true">
          <span key={currentId} style={{ animationPlayState: paused ? 'paused' : 'running' }} onAnimationEnd={() => { if (!paused) move(1); }} />
        </div>
      )}
    </section>
  );
}
