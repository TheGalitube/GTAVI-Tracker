import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { standings } from '../../lib/broadcast.js';
import Standings from './Standings.jsx';
import History from './History.jsx';
import './broadcast.css';

const EMPTY = [];
const amount = (n) => n == null ? '—' : n.toLocaleString();

function useRotation(length, ms) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % length), ms);
    return () => window.clearInterval(timer);
  }, [length, ms]);
  return length ? index % length : 0;
}

function total(teams, field) {
  if (!teams.length || teams.some((t) => t[field] == null)) return null;
  return teams.reduce((sum, team) => sum + team[field], 0);
}

function Activity({ teams }) {
  const max = Math.max(1, ...teams.flatMap((t) => t.activityHistory));
  return <section className="air-activity"><h2>Team activity</h2><p className="air-caption">PR events · last 24 hours</p>
    <div className="air-activity-list">{teams.map((t) => <div className="air-activity-row" key={t.id}>
      <div><strong>{t.name}</strong><small>{t.activity == null ? 'Unknown' : t.activity > 0 ? 'Active' : t.activityTruncated ? 'Coverage limited' : 'Quiet ≥24h'}</small></div>
      <span className="air-bars">{t.activityHistory.map((v, i) => <i key={i} style={{ background: t.color, height: (v / max * 100) + '%' }} />)}</span>
      <b>{amount(t.activity)}{t.activityTruncated && t.activity != null ? '+' : ''}</b>
    </div>)}</div>
  </section>;
}

function Feed({ events }) {
  const page = useRotation(Math.ceil(events.length / 3), 12_000);
  return <section className="air-feed"><h2>Recent PRs</h2>
    <div className="air-reel"><div className="air-reel-inner" style={{ transform: `translateY(-${page * 100}%)` }}>
      {events.map((e) => <article key={e.team + e.id + e.kind} style={{ '--team': e.teamColor }}>
        <strong>{e.title}</strong><span>{e.team} · #{e.number ?? '—'} · <b>{e.kind}</b></span>
      </article>)}
    </div></div>{!events.length && <p className="air-empty">Waiting for pull request activity.</p>}
  </section>;
}

function Featured({ pulls }) {
  const [selectedId, setSelectedId] = useState(null);
  const index = Math.max(0, pulls.findIndex((item) => item.id === selectedId));
  const pr = pulls[index];
  const currentId = pr?.id ?? null;
  if (selectedId !== currentId) setSelectedId(currentId);

  const rotating = pulls.length > 1;
  const nextId = useRef(null);
  const card = useRef(null);
  const bar = useRef(null);
  useLayoutEffect(() => {
    nextId.current = rotating ? pulls[(index + 1) % pulls.length].id : null;
  }, [pulls, index, rotating]);

  useLayoutEffect(() => {
    if (!rotating) return;
    const duration = 20_000;
    const fade = 350 / duration;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const progress = bar.current.animate(
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration, fill: 'both' }
    );
    const transition = card.current.animate([
      { opacity: 0, transform: 'translateY(4px)' },
      { offset: fade, opacity: 1, transform: 'none' },
      { offset: 1 - fade, opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(-4px)' },
    ], { duration, fill: 'both' });
    const applyMotion = () => {
      progress.effect.updateTiming({ easing: motion.matches ? 'steps(20, end)' : 'linear' });
      if (motion.matches) transition.cancel();
      else {
        transition.play();
        transition.currentTime = progress.currentTime;
      }
    };
    applyMotion();
    motion.addEventListener('change', applyMotion);
    progress.onfinish = () => setSelectedId(nextId.current);
    return () => {
      motion.removeEventListener('change', applyMotion);
      progress.onfinish = null;
      progress.cancel();
      transition.cancel();
    };
  }, [currentId, rotating]);
  const title = useRef(null);
  useLayoutEffect(() => {
    if (!title.current) return;
    const node = title.current;
    const fit = () => {
      node.style.fontSize = '';
      let size = parseFloat(getComputedStyle(node).fontSize);
      while (node.scrollHeight > node.clientHeight + 1 && size > 9) node.style.fontSize = --size + 'px';
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [pr?.id, pr?.title]);
  return <section className="air-feature"><h2>Featured PR</h2>{pr ? <>
    <div className="air-feature-card" ref={card}>
      <div className="air-pr-meta"><i style={{ background: pr.teamColor }} />{pr.team} · #{pr.number ?? '—'} · {pr.kind === 'opened' ? 'Open' : pr.kind}</div>
      <strong className="air-feature-title" ref={title}>{pr.title}</strong>
      <div className="air-pr-counts">{[['Additions', pr.additions], ['Deletions', pr.deletions], ['Files', pr.files], ['Commits', pr.commits]].map(([label, value]) => <div key={label}><b>{amount(value)}</b><small>{label}</small></div>)}</div>
    </div>
    {rotating && <div className="air-feature-timer" aria-hidden="true"><i ref={bar} style={{ backgroundColor: pr.teamColor }} /></div>}
  </> : <p className="air-empty">Waiting for a pull request.</p>}</section>;
}

function Ticker({ messages }) {
  const text = messages.join('　 ·　 ');
  return <footer className="air-ticker"><b>Race wire</b><div><div className="air-tape" style={{ '--duration': Math.max(30, text.length / 7) + 's' }}>
    <span>{text}</span><span aria-hidden="true">{text}</span>
  </div></div></footer>;
}

export default function Broadcast({ snapshot, movement, raceNews }) {
  const teams = useMemo(() => standings(snapshot?.teams ?? EMPTY), [snapshot?.teams]);
  const events = snapshot?.events ?? EMPTY;
  const current = snapshot?.pullRequests ?? EMPTY;
  const pulls = current.length ? current : events;
  const time = snapshot?.raceObservedAt;
  const observedActive = teams.filter((team) => team.activity > 0).length;
  const incompleteActivity = teams.some((team) => team.activity == null || (!team.activity && team.activityTruncated));
  const activeTotal = !teams.length || teams.every((team) => team.activity == null) ? null
    : incompleteActivity ? observedActive + '+' : observedActive;
  const stats = [['Open PRs', total(teams, 'openPullRequests')], ['Merged PRs', total(teams, 'mergedTotal')],
    ['Active teams · 24h', activeTotal], ['GitHub stars', total(teams, 'stars')]];
  const messages = [...raceNews.map((e) => e.team + ' · ' + e.title),
    ...events.slice(0, 6).map((e) => `${e.team} ${e.kind} #${e.number ?? '—'} · ${e.title}`),
    ...(snapshot?.developments ?? []).map((d) => d.text)];
  const [portrait, setPortrait] = useState(() => window.matchMedia('(max-aspect-ratio: 1/1)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-aspect-ratio: 1/1)');
    const update = () => setPortrait(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const scene = useRotation(portrait ? 3 : 1, 18_000);
  return <>
    <section className="air-stats">{stats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{amount(value)}</strong></div>)}</section>
    <div className="air-panels" data-scene={scene}>
      <Standings teams={teams} movement={movement} history={snapshot?.history ?? EMPTY} time={time} />
      <Feed events={events} />
      <History teams={teams} history={snapshot?.history ?? EMPTY} time={time} />
      <Activity teams={teams} />
      <Featured pulls={pulls} />
    </div>
    <Ticker messages={messages.length ? messages : ['Waiting for race updates']} />
  </>;
}
