export default function TeamTable({ teams = [] }) {
  return (
    <section className="team-table-wrap" aria-label="Team comparison">
      <table className="team-table">
        <thead><tr><th>Team</th><th>Progress</th><th>Open PRs</th><th>Merged today</th><th>Total PRs</th><th>Stars</th><th>Activity · 24h</th></tr></thead>
        <tbody>
          {teams.map((team) => <tr key={team.id} style={{ '--team-color': team.color }}>
            <th scope="row"><span className="team-mark" />{team.name}</th>
            <td><div className="table-progress"><span>{display(team.progress, '%')}</span><span className="table-track"><i style={{ width: `${Math.max(0, Math.min(100, team.progress ?? 0))}%` }} /></span></div></td>
            <td>{display(team.openPullRequests)}</td><td>{display(team.mergedToday)}</td><td>{display(team.totalPullRequests)}</td><td>{display(team.stars)}</td>
            <td><ActivityBars value={team.activity} history={team.activityHistory} color={team.color} truncated={team.activityTruncated} /></td>
          </tr>)}
          {teams.length === 0 && <tr><td className="table-empty" colSpan="7">Waiting for live team data from Portwatch.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

function display(value, suffix = '') {
  return value == null ? '—' : `${Number(value).toLocaleString()}${suffix}`;
}

function ActivityBars({ value, history, color, truncated }) {
  if (value == null) return <span className="activity-empty">—</span>;
  const max = Math.max(1, ...(history ?? []));
  return <span className="activity-cell" aria-label={`At least ${value} pull requests in the last 24 hours`}>
    {history?.length > 0 && <span className="activity-bars">{history.map((point, index) => <i key={index} style={{ height: `${Math.max(5, (point / max) * 100)}%`, backgroundColor: color }} />)}</span>}<b>{value}{truncated ? '+' : ''}</b>
  </span>;
}
