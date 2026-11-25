const STAGES = ['Groundwork', 'Execution', 'First frame', 'Main menu', 'In the world', 'Playable'];

export default function RaceProgress({ teams = [] }) {
  return (
    <section className="race-panel" aria-label="Race progress by team">
      <div className="stage-axis">
        {STAGES.map((stage) => <span key={stage}>{stage}</span>)}
      </div>
      <div className="team-lanes">
        {teams.map((team) => {
          const progress = Math.max(0, Math.min(100, team.progress ?? 0));
          return (
            <div className="race-lane" key={team.id} style={{ '--team-color': team.color }}>
              <a className="lane-name" href={team.repository || undefined} target={team.repository ? '_blank' : undefined} rel="noreferrer">
                <span className="team-mark" />{team.name}
              </a>
              <div className="lane-track" aria-label={`${team.name} progress ${progress}%`}>
                <div className="lane-fill" style={{ width: `${progress}%` }} />
                {STAGES.map((stage, index) => (
                  <span className={`stage-dot ${progress >= index * 20 ? 'reached' : ''}`} style={{ left: `${index * 20}%` }} key={stage} />
                ))}
              </div>
              <strong className="lane-percent">{team.progress == null ? '—' : `${progress}%`}</strong>
            </div>
          );
        })}
        {teams.length === 0 && <div className="empty-race">Team progress will appear when the Portwatch feed is connected.</div>}
      </div>
    </section>
  );
}
