import { useState } from 'react';

const columns = [
  ['name', 'Team'], ['progress', 'Progress'], ['openPullRequests', 'Open PRs'],
  ['mergedToday', 'Merged today'], ['totalPullRequests', 'Total PRs'],
  ['stars', 'Stars'], ['activity', 'Activity · 24h'],
];

export default function TeamTable({ teams = [] }) {
  const [sort, setSort] = useState({ key: 'progress', ascending: false });
  const sortedTeams = [...teams].sort((a, b) => {
    const left = a[sort.key];
    const right = b[sort.key];
    if (left == null || right == null) return Number(left == null) - Number(right == null);
    const order = sort.key === 'name' ? left.localeCompare(right) : left - right;
    return sort.ascending ? order : -order;
  });

  return (
    <section className="team-table-wrap" aria-label="Team comparison">
      <table className="team-table">
        <thead><tr>{columns.map(([key, label]) => (
          <th key={key} scope="col" aria-sort={key === sort.key ? (sort.ascending ? 'ascending' : 'descending') : undefined}>
            <button onClick={() => setSort({ key, ascending: key === sort.key ? !sort.ascending : key === 'name' })}>
              {label} <span aria-hidden="true">{key === sort.key ? (sort.ascending ? '↑' : '↓') : '↕'}</span>
            </button>
          </th>
        ))}</tr></thead>
        <tbody>
          {sortedTeams.map((team) => <tr key={team.id} style={{ '--team-color': team.color }}>
            <th scope="row"><span className="team-mark" />{team.repository
              ? <a href={team.repository} target="_blank" rel="noreferrer">{team.name}</a>
              : team.name}</th>
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
  const description = `${truncated ? 'At least ' : ''}${value} PR events in the last 24 hours`;
  return <span className="activity-cell" role="img" aria-label={description} title={description}>
    {history?.length > 0 && <span className="activity-bars">{history.map((point, index) => <i key={index} style={{ height: `${(point / max) * 100}%`, backgroundColor: color }} />)}</span>}<b>{value}{truncated ? '+' : ''}</b>
  </span>;
}
