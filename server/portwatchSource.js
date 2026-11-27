const TRACKER_URL = 'https://portwatch-vi.xyz/data/tracker.json';
const GITHUB_API = 'https://api.github.com';
const TRACKER_CACHE_MS = 5 * 60_000;
const COUNT_CACHE_MS = 5 * 60_000;
const PR_CACHE_MS = 10_000;

const TEAM_COLORS = ['#b483ff', '#ff9b59', '#3edbd0', '#5a9cff', '#3dd99b'];
const trackerCache = { value: null, expiresAt: 0, promise: null };
let githubCaches;

export async function getPortwatchSnapshot() {
  const tracker = await cached(trackerCache, TRACKER_CACHE_MS, fetchTracker);
  const teams = selectTeams(tracker.efforts);
  const rosterKey = JSON.stringify(teams.map(({ id, name, repo }) => [id, name, repo]).sort());
  if (githubCaches?.rosterKey !== rosterKey) {
    githubCaches = { rosterKey, counts: {}, activity: {} };
  }
  const { counts: countsCache, activity: pullCache } = githubCaches;
  const [counts, activityByTeam] = await Promise.all([
    cached(countsCache, COUNT_CACHE_MS, () => fetchTeamCounts(teams)),
    cached(pullCache, PR_CACHE_MS, () => fetchTeamActivity(teams, pullCache.value ?? {})),
  ]);
  return assembleSnapshot(tracker, teams, counts, activityByTeam);
}

function selectTeams(efforts) {
  const ranked = efforts
    .filter((effort) => typeof effort?.id === 'string' && !effort.nuked && validRepo(effort.repo))
    .map((effort) => ({ ...effort, name: effort.name || effort.id, ...scoreEffort(effort) }))
    .sort((a, b) => b.progress - a.progress);

  const repos = new Set();
  return ranked.filter(({ repo }) => {
    const key = repo.toLowerCase();
    if (repos.has(key)) return false;
    repos.add(key);
    return true;
  }).slice(0, TEAM_COLORS.length);
}

async function cached(cache, ttl, load) {
  if (cache.value && Date.now() < cache.expiresAt) return cache.value;
  if (cache.promise) return cache.promise;
  cache.promise = load();
  try {
    const value = await cache.promise;
    cache.value = value;
    cache.expiresAt = Date.now() + ttl;
    return value;
  } catch (error) {
    if (cache.value) {
      cache.expiresAt = Date.now() + 30_000;
      return cache.value;
    }
    throw error;
  } finally {
    cache.promise = null;
  }
}

async function fetchTracker() {
  const data = await fetchJson(TRACKER_URL);
  if (!Array.isArray(data.efforts)) throw new Error('PortWatch did not return its expected efforts list.');
  return data;
}

async function fetchTeamCounts(teams) {
  return Object.fromEntries(await Promise.all(teams.map(async ({ id, repo }) => {

    const today = new Date().toISOString().slice(0, 10);
    const queries = [
      githubSearchCount(`repo:${repo} is:pr is:open`),
      githubSearchCount(`repo:${repo} is:pr`),
      githubSearchCount(`repo:${repo} is:pr is:merged merged:>=${today}`),
    ];
    const result = await Promise.allSettled(queries);
    return [id, {
      openPullRequests: settledNumber(result[0]),
      totalPullRequests: settledNumber(result[1]),
      mergedToday: settledNumber(result[2]),
    }];
  })));
}

async function fetchTeamActivity(teams, prior) {
  return Object.fromEntries(await Promise.all(teams.map(async ({ id, name, repo }) => {
    const empty = { events: [], pullRequests: [], activity: null, activityHistory: [], activityTruncated: false };

    try {
      const [eventFeed, openPulls] = await Promise.all([
        fetchPullEvents(repo),
        fetchJson(`${GITHUB_API}/repos/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=1`),
      ]);
      if (!Array.isArray(openPulls)) throw new Error(`GitHub returned an invalid open pull request list for ${repo}.`);

      const oldEvents = new Map((prior[id]?.events ?? []).map((event) => [event.id, event.pullRequest]));
      const previousCurrentPull = prior[id]?.pullRequests?.[0];
      const currentPullRequest = openPulls[0]
        ? previousCurrentPull?.number === openPulls[0].number && previousCurrentPull?.updated_at === openPulls[0].updated_at
          ? previousCurrentPull
          : await fetchJson(`${GITHUB_API}/repos/${repo}/pulls/${openPulls[0].number}`).catch(() => openPulls[0])
        : null;
      const lifecycleEvents = eventFeed.events.filter(isPullRequestLifecycleEvent);
      const displayEvents = await Promise.all(lifecycleEvents.slice(0, 6).map(async (event) => {
        const number = event.payload?.pull_request?.number;
        const oldDetails = oldEvents.get(String(event.id));
        const details = oldDetails ?? (number
          ? await fetchJson(`${GITHUB_API}/repos/${repo}/pulls/${number}`).catch(() => event.payload?.pull_request ?? {})
          : {});
        return normalizePullEvent(event, details, name, id, repo);
      }));

      const cutoff = Date.now() - 86_400_000;
      const activityHistory = Array(12).fill(0);
      for (const event of lifecycleEvents) {
        const age = Date.now() - Date.parse(event.created_at);
        if (age < 0 || age >= 86_400_000) continue;
        const bucket = 11 - Math.floor(age / 7_200_000);
        activityHistory[bucket] += 1;
      }
      return [id, {
        events: displayEvents,
        pullRequests: currentPullRequest ? [{
          ...currentPullRequest,
          _team: name,
          _teamId: id,
          _repo: repo,
        }] : [],
        activity: lifecycleEvents.filter((event) => Date.parse(event.created_at) >= cutoff).length,
        activityHistory,
        activityTruncated: eventFeed.truncated,
      }];
    } catch (error) {
      return [id, {
        ...(prior[id] ?? empty),
        warning: `GitHub data for ${name} is unavailable: ${error.message || 'the request failed.'}`,
      }];
    }
  })));
}

async function fetchPullEvents(repo) {
  const cutoff = Date.now() - 86_400_000;
  const events = [];
  let truncated = false;
  for (let page = 1; page <= 1; page += 1) {
    const url = `${GITHUB_API}/repos/${repo}/events?per_page=100&page=${page}`;
    const batch = await fetchJson(url);
    if (!Array.isArray(batch)) throw new Error(`GitHub returned an invalid activity feed for ${repo}.`);
    events.push(...batch);
    const oldest = batch.at(-1)?.created_at;
    if (!batch.length || batch.length < 100 || !oldest || Date.parse(oldest) < cutoff) break;
    if (page === 1 && batch.length === 100 && Date.parse(oldest) >= cutoff) truncated = true;
  }
  return { events: events.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), truncated };
}

function isPullRequestLifecycleEvent(event) {
  return event.type === 'PullRequestEvent' && ['opened', 'reopened', 'closed'].includes(event.payload?.action);
}

function normalizePullEvent(event, details, team, teamId, repo) {
  const action = event.payload?.action;
  const pull = details ?? {};
  const timestamp = event.created_at;
  const closeTime = Date.parse(pull.merged_at);
  const eventTime = Date.parse(timestamp);
  const merged = action === 'closed' && Number.isFinite(closeTime) && closeTime <= eventTime + 60_000 && closeTime >= eventTime - 60_000;
  const kind = merged ? 'merged' : action === 'closed' ? 'closed' : 'opened';
  return {
    id: String(event.id),
    kind,
    number: pull.number ?? event.payload?.pull_request?.number ?? null,
    title: pull.title ?? `Pull request #${pull.number ?? event.payload?.pull_request?.number ?? ''}`,
    team,
    teamId,
    author: pull.user?.login ?? event.actor?.login ?? 'Contributor',
    avatarUrl: pull.user?.avatar_url ?? event.actor?.avatar_url ?? null,
    additions: numberOrNull(pull.additions),
    deletions: numberOrNull(pull.deletions),
    files: numberOrNull(pull.changed_files),
    commits: numberOrNull(pull.commits),
    timestamp,
    url: pull.html_url ?? `https://github.com/${repo}/pull/${pull.number ?? event.payload?.pull_request?.number}`,
    pullRequest: pull,
  };
}

async function githubSearchCount(query) {
  const url = new URL(`${GITHUB_API}/search/issues`);
  url.searchParams.set('q', query);
  const data = await fetchJson(url.toString());
  if (!Number.isFinite(data.total_count)) throw new Error('GitHub did not return a pull request count.');
  return data.total_count;
}

async function fetchJson(url) {
  const token = new URL(url).origin === GITHUB_API ? process.env.GITHUB_TOKEN?.trim() : undefined;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'PortRaceTracker/0.1',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Request to ${new URL(url).host} returned HTTP ${response.status}.`);
  return response.json();
}

function assembleSnapshot(tracker, rankedTeams, counts, activityByTeam) {
  const teams = rankedTeams.map(({ id, name, repo, progress, stage, stats }, index) => {
    const metrics = counts?.[id] ?? emptyCounts();
    return {
      id,
      name,
      color: TEAM_COLORS[index],
      progress,
      stage,
      openPullRequests: metrics.openPullRequests,
      totalPullRequests: metrics.totalPullRequests,
      mergedToday: metrics.mergedToday,
      stars: numberOrNull(stats?.stars),
      activity: activityByTeam?.[id]?.activity ?? null,
      activityHistory: activityByTeam?.[id]?.activityHistory ?? [],
      activityTruncated: Boolean(activityByTeam?.[id]?.activityTruncated),
      repository: `https://github.com/${repo}`,
    };
  });
  const colors = new Map(teams.map((team) => [team.id, team.color]));
  const events = teams.flatMap(({ id }) => (activityByTeam?.[id]?.events ?? []).map((event) => ({
    ...event,
    teamColor: colors.get(id),
    pullRequest: undefined,
  }))).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const pullRequests = teams.flatMap(({ id }) => (activityByTeam?.[id]?.pullRequests ?? []).map((pull) => ({
    id: `${pull._repo}#${pull.number}`,
    kind: 'opened',
    number: pull.number,
    title: pull.title,
    team: pull._team,
    teamColor: colors.get(id),
    author: pull.user?.login ?? 'Contributor',
    additions: numberOrNull(pull.additions),
    deletions: numberOrNull(pull.deletions),
    files: numberOrNull(pull.changed_files),
    commits: numberOrNull(pull.commits),
    timestamp: pull.updated_at ?? pull.created_at,
    url: pull.html_url,
  }))).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return {
    state: 'connected',
    updatedAt: new Date().toISOString(),
    sourceUpdatedAt: tracker.updated ?? null,
    teams,
    events,
    pullRequests,
    sourceWarnings: [...new Set(teams.map(({ id }) => activityByTeam?.[id]?.warning).filter(Boolean))],
  };
}

function emptyCounts() {
  return { openPullRequests: null, totalPullRequests: null, mergedToday: null };
}

function validRepo(value) {
  return typeof value === 'string'
    && /^[A-Za-z0-9-]+\/(?!\.{1,2}$)[A-Za-z0-9_.-]+$/.test(value);
}

function settledNumber(result) {
  return result.status === 'fulfilled' ? result.value : null;
}

function numberOrNull(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp01(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

function ladderValue(value) {
  if (value === true) return 1;
  if (value === false || value == null) return 0;
  return clamp01(value);
}

function scoreEffort(effort) {
  const ticks = { loads: 10, boots: 20, menu: 30, world: 40, playable: 50 };
  const ladder = Object.keys(ticks);
  const groundworkWeights = { loader: 0.2, shaders: 0.28, graphics: 0.32, proven: 0.2 };
  const groundwork = Object.entries(groundworkWeights).reduce((sum, [key, weight]) => sum + weight * clamp01(effort.groundwork?.[key]), 0);
  const gta = effort.gta ?? {};
  let progress = 10 * groundwork;
  let reached = 'Groundwork';
  let previousTick = progress;

  for (const key of ladder) {
    const value = ladderValue(gta[key]);
    if (value >= 1) {
      progress = ticks[key];
      previousTick = progress;
      reached = key;
      continue;
    }
    if (value > 0) progress = Math.max(progress, previousTick + value * (ticks[key] - previousTick));
    break;
  }

  if (reached === 'playable') {
    const stabilityValues = { unknown: 0, constant: 0, often: 0.25, sometimes: 0.55, rarely: 0.8, stable: 1 };
    const stability = typeof gta.stability === 'number' ? clamp01(gta.stability) : stabilityValues[gta.stability] ?? 0;
    const quality = 0.35 * clamp01(gta.story) + 0.25 * clamp01(gta.render) + 0.2 * clamp01((Number(gta.fps) || 0) / 30) + 0.2 * stability;
    progress = 50 + quality * 50;
    if (quality >= 1) reached = 'complete';
  }

  if (Number.isFinite(effort.manualScore)) progress = Math.min(100, Math.max(0, effort.manualScore));
  const stageLabels = { loads: 'Execution', boots: 'First frame', menu: 'Main menu', world: 'In the world', playable: 'Playable', complete: 'Complete' };
  return { progress: Math.round(progress * 10) / 10, stage: stageLabels[reached] ?? reached };
}
