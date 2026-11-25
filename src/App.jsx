import { useCallback, useRef, useState } from 'react';
import { BellRing, ChevronDown, ExternalLink, Github, Radio, Volume2, VolumeX } from 'lucide-react';
import RaceProgress from './components/RaceProgress.jsx';
import LiveFeed from './components/LiveFeed.jsx';
import TeamTable from './components/TeamTable.jsx';
import AlertDialog from './components/AlertDialog.jsx';
import { usePortwatch } from './hooks/usePortwatch.js';

const previewEvent = {
  id: 'preview-2197', kind: 'opened', number: 2197,
  title: 'config: flag fidelityfx_dir in `victory config` policy check; fix example comment',
  team: 'Victory', author: 'romeawayfromhome-rgb', additions: 4, deletions: 1, files: 2,
};

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [previewAlert, setPreviewAlert] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('portrace:sound') === 'on');
  const [muteFutureAlerts, setMuteFutureAlerts] = useState(() => localStorage.getItem('portrace:mute-alerts') === 'on');
  const audioContext = useRef(null);

  const playChime = useCallback((force = false) => {
    if (!soundEnabled && !force) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audioContext.current ||= new Context();
    const context = audioContext.current;
    if (context.state === 'suspended') context.resume();
    const start = context.currentTime;
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + index * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.13, start + index * 0.13 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + index * 0.13 + 0.35);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start + index * 0.13);
      oscillator.stop(start + index * 0.13 + 0.36);
    });
  }, [soundEnabled]);

  const onEvents = useCallback((events) => {
    const lifecycleEvents = events.filter((event) => ['opened', 'closed', 'merged'].includes(event.kind));
    if (!lifecycleEvents.length || muteFutureAlerts) return;
    setAlerts((current) => [...current, ...lifecycleEvents]);
    playChime();
  }, [playChime, muteFutureAlerts]);

  const { snapshot, connection, error } = usePortwatch(onEvents);
  const teams = snapshot?.teams ?? [];
  const teamColors = new Map(teams.map((team) => [team.name.toLowerCase(), team.color]));
  const feedEvents = (snapshot?.events ?? []).map((event) => ({
    ...event,
    teamColor: teamColors.get(event.team.toLowerCase()),
  }));
  const currentPullRequest = snapshot?.pullRequests?.find((event) => event.kind === 'opened') ?? null;
  const activeAlert = previewAlert ? previewEvent : alerts[0] ?? null;

  const changeSound = (enabled) => {
    setSoundEnabled(enabled);
    localStorage.setItem('portrace:sound', enabled ? 'on' : 'off');
    if (enabled && (window.AudioContext || window.webkitAudioContext)) {
      audioContext.current ||= new (window.AudioContext || window.webkitAudioContext)();
      audioContext.current.resume();
      playChime(true);
    }
  };

  const dismissAlert = () => {
    if (previewAlert) setPreviewAlert(false);
    else setAlerts((current) => current.slice(1));
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="PortRace dashboard"><span className="brand-mark">&gt;_</span><strong>PortRace</strong></a>
        <nav className="main-nav" aria-label="Main navigation">
          <a className="selected" href="#top">Dashboard</a><a href="#pull-requests">Pull Requests</a><a href="#teams">Teams</a><a href="#race">Race</a>
        </nav>
        <div className="topbar-status">
          <span className={`live-indicator ${connection}`}><i />{connection === 'live' ? 'LIVE' : connection === 'offline' ? 'OFFLINE' : 'WAITING'}</span>
          <span className="updated-at">{snapshot?.updatedAt ? `Updated ${formatUpdated(snapshot.updatedAt)}` : 'Awaiting source'}</span>
          <button className="sound-quick" onClick={() => changeSound(!soundEnabled)} aria-label={soundEnabled ? 'Turn sound off' : 'Turn sound on'} aria-pressed={soundEnabled}>
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
        </div>
      </header>

      <main id="top" className="dashboard">
        <div className="intro-row">
          <div className="intro-copy">
            <p className="eyebrow">GTA VI <span>·</span> PC PORT RACE</p>
            <h1>Five contenders. One finish line.</h1>
            <p className="intro-subtitle">Live progress toward GTA VI running on PC.</p>
          </div>
          <button className="preview-button" onClick={() => setPreviewAlert(true)}><BellRing size={16} /> Preview alert</button>
        </div>

        {connection !== 'live' && <div className={`connection-notice ${connection}`} role="status">
          <Radio size={17} />
          <div><strong>{connection === 'offline' ? 'Portwatch is unreachable' : 'Waiting for Portwatch data'}</strong><span>{error || 'Live race data will appear here once the feed is connected.'}</span></div>
          <a href="https://portwatch-vi.xyz/" target="_blank" rel="noreferrer">Open source <ExternalLink size={13} /></a>
        </div>}

        <div className="primary-grid">
          <div className="race-column" id="race">
            <div className="section-heading"><div><span className="section-kicker">RACE TO PLAYABLE</span><ChevronDown size={15} /></div><span>{teams.length ? `${teams.length} teams` : 'No team data'}</span></div>
            <RaceProgress teams={teams} />
            <section className="current-pr" aria-label="Current pull request">
              <span className="current-label">CURRENT PULL REQUEST</span>
              {currentPullRequest ? <>
                <a className="current-title" href={currentPullRequest.url || undefined} target={currentPullRequest.url ? '_blank' : undefined} rel="noreferrer"><Github size={23} /><strong>#{currentPullRequest.number}</strong><span>{currentPullRequest.title}</span></a>
                <div className="current-meta"><span className="team-pill">{currentPullRequest.team}</span><span>{currentPullRequest.author}</span><span className="change additions">+{currentPullRequest.additions ?? '—'}</span><span className="change deletions">−{currentPullRequest.deletions ?? '—'}</span><span>{currentPullRequest.files ?? '—'} files</span><span>{currentPullRequest.commits ?? '—'} commits</span></div>
              </> : <div className="current-empty">The latest active pull request will appear here.</div>}
            </section>
          </div>
          <div id="pull-requests"><LiveFeed events={feedEvents} /></div>
        </div>

        <div id="teams"><TeamTable teams={teams} /></div>
        <footer className="source-line"><span>Race data: <a href="https://portwatch-vi.xyz/" target="_blank" rel="noreferrer">portwatch-vi.xyz</a></span><span>Refreshes every 30 seconds</span></footer>
      </main>

      <AlertDialog event={activeAlert} preview={previewAlert} soundEnabled={soundEnabled} muteFutureAlerts={muteFutureAlerts} onSoundChange={changeSound} onMuteFutureChange={(value) => { setMuteFutureAlerts(value); localStorage.setItem('portrace:mute-alerts', value ? 'on' : 'off'); }} onDismiss={dismissAlert} />
    </div>
  );
}

function formatUpdated(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'just now';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
