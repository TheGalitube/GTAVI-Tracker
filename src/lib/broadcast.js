export const stages = [
  ['Groundwork', 0], ['Execution', 10], ['First frame', 20], ['Main menu', 30],
  ['In the world', 40], ['Playable', 50], ['Complete', 100],
];
export const DAY = 86_400_000;

export function standings(teams) {
  const ranked = [...teams].sort((a, b) => (b.progress ?? -1) - (a.progress ?? -1) || a.id.localeCompare(b.id));
  let rank;
  return ranked.map((team, index) => {
    if (!index || ranked[index - 1].progress !== team.progress) rank = index + 1;
    return { ...team, rank: team.progress == null ? null : rank };
  });
}

export function raceChanges(previous, next) {
  const before = new Map(standings(previous.teams).map((team) => [team.id, team]));
  const changes = [];
  const movement = {};
  for (const team of standings(next.teams)) {
    const old = before.get(team.id);
    if (!old) continue;
    const base = { team: team.name, teamColor: team.color, timestamp: next.updatedAt };
    const start = stages.findIndex(([name]) => name === old.stage);
    const end = stages.findIndex(([name]) => name === team.stage);
    if (start >= 0 && end > start) changes.push({ ...base, id: 'stage-' + team.id + '-' + next.raceObservedAt, kind: 'milestone', title: 'Reached ' + team.stage });
    if (old.rank != null && team.rank != null && old.rank !== team.rank) {
      movement[team.id] = old.rank - team.rank;
      if (old.rank > team.rank) changes.push({ ...base, id: 'rank-' + team.id + '-' + next.raceObservedAt, kind: 'position', title: 'Moved up to position ' + team.rank });
    }
  }
  return { changes, movement };
}

export function dayChange(team, history, observedAt) {
  const cutoff = observedAt - DAY;
  const baseline = history.findLast((row) => row.time <= cutoff && row.time >= cutoff - 600_000 && Number.isFinite(row.scores?.[team.id]));
  if (!baseline || team.progress == null) return null;
  return Math.round((team.progress - baseline.scores[team.id]) * 10) / 10;
}

export function mergeObservedHistory(history, teams, observedAt, cached = false) {
  const cutoff = Date.now() - DAY - 600_000;
  const samples = new Map();
  for (const sample of history ?? []) {
    if (!Number.isFinite(sample?.time) || sample.time < cutoff || !sample.scores || typeof sample.scores !== 'object') continue;
    const scores = Object.fromEntries(Object.entries(sample.scores).filter(([, score]) => Number.isFinite(score)));
    if (Object.keys(scores).length) samples.set(sample.time, { time: sample.time, scores });
  }
  if (!cached && Number.isFinite(observedAt) && observedAt >= cutoff) {
    const scores = Object.fromEntries(teams.filter((team) => Number.isFinite(team.progress)).map((team) => [team.id, team.progress]));
    if (Object.keys(scores).length) samples.set(observedAt, { time: observedAt, scores });
  }
  return [...samples.values()].sort((a, b) => a.time - b.time);
}
