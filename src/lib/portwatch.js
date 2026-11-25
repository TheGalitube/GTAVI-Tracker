const FEED_URL = '/api/portwatch';

export async function fetchPortwatchSnapshot(signal) {
  const response = await fetch(FEED_URL, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (response.status === 503) {
    const body = await response.json().catch(() => ({}));
    return { state: 'unconfigured', message: body.message };
  }
  if (!response.ok) throw new Error(`Portwatch returned ${response.status}`);

  const payload = await response.json();
  return normalizeSnapshot(payload);
}

function normalizeSnapshot(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Portwatch response was not a JSON object');
  }

  const teams = Array.isArray(payload.teams) ? payload.teams : [];
  const events = Array.isArray(payload.events) ? payload.events : [];
  const pullRequests = Array.isArray(payload.pullRequests)
    ? payload.pullRequests
    : Array.isArray(payload.pull_requests)
      ? payload.pull_requests
      : [];

  return {
    state: 'connected',
    updatedAt: payload.updatedAt || payload.updated_at || new Date().toISOString(),
    teams: teams.map(normalizeTeam),
    events: events.map(normalizeEvent),
    pullRequests: pullRequests.map(normalizePullRequest),
  };
}

function normalizeTeam(team, index) {
  return {
    id: String(team.id ?? team.name ?? index),
    name: String(team.name ?? 'Unknown team'),
    color: String(team.color ?? ['#b483ff', '#ff9b59', '#3edbd0', '#5a9cff', '#3dd99b'][index % 5]),
    progress: finiteNumber(team.progress ?? team.progress_percent),
    stage: team.stage ?? null,
    openPullRequests: finiteNumber(team.openPullRequests ?? team.open_prs),
    mergedToday: finiteNumber(team.mergedToday ?? team.merged_today),
    totalPullRequests: finiteNumber(team.totalPullRequests ?? team.total_prs),
    stars: finiteNumber(team.stars),
    activity: finiteNumber(team.activity),
    activityTruncated: Boolean(team.activityTruncated),
    activityHistory: Array.isArray(team.activityHistory ?? team.activity_history)
      ? (team.activityHistory ?? team.activity_history).map(finiteNumber).filter((value) => value != null)
      : [],
    repository: team.repository ?? team.repo_url ?? null,
  };
}

function normalizeEvent(event, index) {
  const action = String(event.action ?? event.type ?? '').toLowerCase();
  const kind = action.includes('merge')
    ? 'merged'
    : action.includes('clos')
      ? 'closed'
      : action.includes('open') || action.includes('reopen')
        ? 'opened'
        : 'updated';

  return {
    id: String(event.id ?? event.node_id ?? event.number ?? index),
    kind,
    number: finiteNumber(event.number ?? event.pull_request_number),
    title: String(event.title ?? event.pull_request?.title ?? 'Pull request update'),
    team: String(event.team ?? event.repository_owner ?? event.author_association ?? 'Unknown team'),
    author: String(event.author ?? event.user?.login ?? event.login ?? 'Contributor'),
    additions: finiteNumber(event.additions),
    deletions: finiteNumber(event.deletions),
    files: finiteNumber(event.changed_files ?? event.files),
    commits: finiteNumber(event.commits),
    timestamp: event.timestamp ?? event.updated_at ?? event.created_at ?? new Date().toISOString(),
    url: event.url ?? event.html_url ?? null,
  };
}

function normalizePullRequest(pr, index) {
  return {
    ...normalizeEvent({ ...pr, action: pr.state === 'closed' ? (pr.merged ? 'merged' : 'closed') : 'opened' }, index),
    state: pr.state ?? 'open',
  };
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function findNewEvents(previous, next) {
  if (!previous) return [];
  const oldEvents = new Map((previous.events ?? []).map((event) => [event.id, event.kind]));
  return (next.events ?? []).filter((event) => {
    if (!['opened', 'closed', 'merged'].includes(event.kind)) return false;
    const priorKind = oldEvents.get(event.id);
    return priorKind === undefined || priorKind !== event.kind;
  });
}
