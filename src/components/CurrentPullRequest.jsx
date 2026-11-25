import { useState } from 'react';
import { Github } from 'lucide-react';

export default function CurrentPullRequest({ pullRequests }) {
  const [index, setIndex] = useState(0);
  const currentPullRequest = pullRequests[index];
  const showNext = () => setIndex((current) => (current + 1) % pullRequests.length);

  return (
    <section className="current-pr" aria-label="Current pull request">
      <span className="current-label">CURRENT PULL REQUEST</span>
      {currentPullRequest ? <>
        <a className="current-title" href={currentPullRequest.url || undefined} target={currentPullRequest.url ? '_blank' : undefined} rel="noreferrer"><Github size={23} /><strong>#{currentPullRequest.number}</strong><span>{currentPullRequest.title}</span></a>
        <div className="current-meta"><span className="team-pill">{currentPullRequest.team}</span><span>{currentPullRequest.author}</span><span className="change additions">+{currentPullRequest.additions ?? '—'}</span><span className="change deletions">−{currentPullRequest.deletions ?? '—'}</span><span>{currentPullRequest.files ?? '—'} files</span><span>{currentPullRequest.commits ?? '—'} commits</span></div>
      </> : <div className="current-empty">The latest active pull request will appear here.</div>}
      {pullRequests.length > 1 && (
        <div className="current-pr__timer" aria-hidden="true">
          <span key={index} onAnimationEnd={showNext} />
        </div>
      )}
    </section>
  );
}
