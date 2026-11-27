import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const directory = join(process.cwd(), '.portrace');
const file = join(directory, 'history.json');
const DAY = 86_400_000;
let samples;

export function recordRace(teams, time) {
  if (!samples) {
    try {
      const saved = JSON.parse(readFileSync(file, 'utf8'));
      samples = Array.isArray(saved) ? saved.filter((row) => Number.isFinite(row.time) && row.scores && typeof row.scores === 'object') : [];
    } catch { samples = []; }
  }
  if (!time || time <= (samples.at(-1)?.time ?? 0)) return samples;
  samples = samples.filter((row) => row.time >= time - DAY - 600_000);
  // The upstream race refreshes every five minutes. Multiple clients share each observation.
  const scores = Object.fromEntries(teams.filter((team) => Number.isFinite(team.progress)).map((team) => [team.id, team.progress]));
  samples.push({ time, scores });
  try {
    mkdirSync(directory, { recursive: true });
    const temp = file + '.' + process.pid + '.tmp';
    writeFileSync(temp, JSON.stringify(samples));
    renameSync(temp, file);
  } catch { /* Read-only hosts retain observations for the server session. */ }
  return samples;
}
