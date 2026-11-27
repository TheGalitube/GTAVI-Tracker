import { useLayoutEffect, useRef } from 'react';
import { dayChange, stages } from '../../lib/broadcast.js';

const signed = (value) => value == null ? '—' : (value > 0 ? '+' : '') + value.toFixed(1);

export default function Standings({ teams, history, time, movement }) {
  const list = useRef(null);
  const previous = useRef(new Map());
  useLayoutEffect(() => {
    const next = new Map();
    for (const row of list.current.children) {
      const top = row.offsetTop;
      const last = previous.current.get(row.dataset.id);
      if (last != null && last !== top && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        row.animate?.([{ transform: `translateY(${last - top}px)` }, { transform: 'none' }], { duration: 520, easing: 'ease-out' });
      }
      next.set(row.dataset.id, top);
    }
    previous.current = next;
  }, [teams]);

  const leaders = teams.filter((team) => team.rank === 1);
  return <section className="air-standings">
    <header className="air-race-title"><h1>Race to playable</h1>
      {leaders.length > 0 && <span><i style={{ background: leaders[0].color }} />{leaders.length > 1 ? 'Joint leaders' : 'Leader'} <b>{leaders.map((t) => t.name).join(' / ')}</b></span>}
    </header>
    <div className="air-row air-columns"><span>#</span><span>Team</span><span className="air-scale" aria-label="Checkpoint scores">{stages.map(([name, score]) => <b key={name} style={{ left: score + '%' }}>{score}</b>)}</span><span>Score</span><span>Gap</span><span>24h Δ</span></div>
    <div className="air-lanes" ref={list}>{teams.map((team) => {
      const diff = movement[team.id] || 0;
      const gain = dayChange(team, history, time);
      const stage = stages.findIndex(([name]) => name === team.stage);
      return <div className="air-row air-team" key={team.id} data-id={team.id} style={{ '--team': team.color }}>
        <span className="air-rank">{team.rank ?? '—'}{diff !== 0 && <small>{diff > 0 ? '↑' : '↓'}{Math.abs(diff)}</small>}</span>
        <strong className="air-name">{team.name}</strong>
        <div className="air-track" role="meter" aria-label={team.name + ' progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={team.progress ?? undefined}>
          {team.progress != null && <i style={{ width: team.progress + '%' }} />}
          {stages.map(([label, percent], index) => <b key={label} className={index <= stage ? 'passed' : ''} style={{ left: percent + '%' }} title={label} />)}
        </div>
        <strong>{team.progress == null ? '—' : team.progress.toFixed(1) + '%'}</strong>
        <span>{team.rank && team.rank !== 1 ? signed(team.progress - leaders[0].progress) : '—'}</span>
        <span className={gain > 0 ? 'positive' : ''}>{signed(gain)}</span>
      </div>;
    })}</div>
    {!teams.length && <p className="air-empty">Waiting for the race feed.</p>}
    <div className="air-checkpoints">{stages.map(([name, value]) => <span key={name}><b>{value}</b> {name}</span>)}</div>
    <small className="air-units">Gap and 24h change in percentage points</small>
  </section>;
}
