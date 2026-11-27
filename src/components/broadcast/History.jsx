import { DAY } from '../../lib/broadcast.js';

export default function History({ teams, history, time }) {
  const start = time - DAY;
  const samples = history.filter((row) => row.time >= start && row.time <= time);
  const trendPoints = teams.reduce((count, team) =>
    count + samples.filter((sample) => Number.isFinite(sample.scores[team.id])).length, 0);
  const span = Math.min(DAY, Math.max(0, time - (samples[0]?.time ?? time)));
  const halfSpan = span / 2;
  const formatSpan = (milliseconds) => milliseconds >= 3_600_000
    ? `−${Math.round(milliseconds / 3_600_000)}h`
    : milliseconds >= 60_000 ? `−${Math.max(1, Math.round(milliseconds / 60_000))}m` : 'First sample';
  return <section className="air-history">
    <h2>Progress history</h2><p className="air-caption">Recorded scores · last 24 hours</p>
    <div className="air-plot"><div className="air-y"><span>100%</span><span>50%</span><span>0%</span></div>
      <svg viewBox="0 0 500 140" preserveAspectRatio="none" role="img" aria-label="Recorded team scores over the previous 24 hours">
        {[4, 70, 136].map((y) => <line key={y} x1="3" x2="497" y1={y} y2={y} stroke="#3b4149" vectorEffect="non-scaling-stroke" />)}
        {teams.map((team) => {
          let lastTime = 0;
          let path = '';
          const dots = [];
          for (const sample of samples) {
            const score = sample.scores[team.id];
            if (!Number.isFinite(score)) { lastTime = 0; continue; }
            const x = span ? 4 + 492 * (sample.time - (time - span)) / span : 496;
            const y = 136 - 1.32 * score;
            const gap = sample.time - lastTime > 600_000;
            path += (gap ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
            if (gap || sample === samples.at(-1)) dots.push(<circle key={sample.time} cx={x} cy={y} r="2.8" fill={team.color} />);
            lastTime = sample.time;
          }
          return <g key={team.id}><title>{team.name}</title><path d={path} fill="none" stroke={team.color} strokeWidth="2.8" vectorEffect="non-scaling-stroke" />{dots}</g>;
        })}
      </svg>
      {(!samples.length || trendPoints <= teams.length) && <span className="air-chart-note">
        {!samples.length ? 'Awaiting observations' : 'Recording team history · next score in about 5 min'}
      </span>}
    </div>
    <div className="air-x"><span>{span >= DAY ? '−24h' : formatSpan(span)}</span><span>{span >= DAY ? '−12h' : span >= 60_000 ? formatSpan(halfSpan) : ''}</span><span>Latest</span></div>
    <div className="air-legend">{teams.map((t) => <span key={t.id}><i style={{ background: t.color }} />{t.name}</span>)}</div>
  </section>;
}
