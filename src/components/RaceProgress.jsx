const STAGES = ['Groundwork', 'Execution', 'First frame', 'Main menu', 'In the world', 'Playable'];

const checkpoints = STAGES.map((label, index) => ({
  label,
  percent: (index / (STAGES.length - 1)) * 100,
}));

export default function RaceProgress({ teams = [] }) {
  return (
    <section className="race-panel" aria-label="Race progress by team">
      <div className="stage-axis">
        <div className="stage-scale">
          {checkpoints.map(({ label, percent }) => (
            <span className="stage-tick" key={label} style={{ left: `${percent}%` }}>
              <span className="stage-label">{label}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="team-lanes">
        {teams.map((team) => {
          const progress = Math.max(0, Math.min(100, team.progress ?? 0));
          return (
            <div className="race-lane" key={team.id} style={{ '--team-color': team.color }}>
              <a className="lane-name" href={team.repository || undefined} target={team.repository ? '_blank' : undefined} rel="noreferrer">
                <span className="team-mark" />{team.name}
              </a>
              <div className="lane-track" role="progressbar" aria-label={`${team.name} progress`} aria-valuenow={team.progress == null ? undefined : progress}>
                {team.progress != null && (
                  <div className="lane-fill" style={{ width: `${progress}%` }}>
                    <span className="lane-marker" aria-hidden="true" />
                  </div>
                )}
                {checkpoints.map(({ label, percent }) => (
                  <span className={`stage-dot ${team.progress != null && progress >= percent ? 'reached' : ''}`} style={{ left: `${percent}%` }} key={label} />
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
