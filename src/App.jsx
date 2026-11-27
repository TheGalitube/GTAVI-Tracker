import { useCallback, useRef, useState } from 'react';
import { BellOff, BellRing, ChevronDown, ExternalLink, Radio, Volume2, VolumeX } from 'lucide-react';
import RaceProgress from './components/RaceProgress.jsx';
import CurrentPullRequest from './components/CurrentPullRequest.jsx';
import LiveFeed from './components/LiveFeed.jsx';
import TeamTable from './components/TeamTable.jsx';
import TransientPRAlert from './components/TransientPRAlert.jsx';
import BackgroundMusic from './components/BackgroundMusic.jsx';
import { usePortwatch } from './hooks/usePortwatch.js';

const previewEvent = {
  id: 'preview-2197', kind: 'opened', number: 2197,
  title: 'config: flag fidelityfx_dir in `victory config` policy check; fix example comment',
  team: 'Victory', author: 'romeawayfromhome-rgb', additions: 4, deletions: 1, files: 2,
};

export default function App() {
  const [raceExpanded, setRaceExpanded] = useState(true);
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

  const { snapshot, connection, error, retry, retrying } = usePortwatch(onEvents);
  const sourceWarnings = snapshot?.sourceWarnings ?? [];
  const showWarnings = connection === 'live' && sourceWarnings.length > 0;
  const teams = snapshot?.teams ?? [];
  const teamColors = new Map(teams.map((team) => [team.name.toLowerCase(), team.color]));
  const feedEvents = (snapshot?.events ?? []).map((event) => ({
    ...event,
    teamColor: event.teamColor ?? teamColors.get(event.team.toLowerCase()),
  }));
  const openPullRequests = (snapshot?.pullRequests ?? []).filter((event) => event.kind === 'opened');
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

  const toggleAlertMute = () => {
    const muted = !muteFutureAlerts;
    setMuteFutureAlerts(muted);
    localStorage.setItem('portrace:mute-alerts', muted ? 'on' : 'off');
    if (muted) setAlerts([]);
  };

  const dismissAlert = useCallback(() => {
    if (previewAlert) setPreviewAlert(false);
    else setAlerts((current) => current.slice(1));
  }, [previewAlert]);

  return (
    <div className="app-shell">
      <main id="top" className="dashboard">
        <header className="dashboard-intro">
          <div className="intro-topline">
            <div className="brand"><span className="brand-mark" aria-hidden="true">&gt;_</span><strong>PortRace</strong></div>
            <div className="intro-status">
              <span className={`live-indicator ${connection}`}><i />{connection === 'live' ? 'LIVE' : connection === 'offline' ? 'OFFLINE' : 'WAITING'}</span>
              <span className="updated-at">{snapshot?.updatedAt ? `${connection === 'live' ? 'Updated' : 'Last successful update'} ${formatUpdated(snapshot.updatedAt)}` : 'Awaiting source'}</span>
              <button className="sound-quick" onClick={toggleAlertMute} aria-label="Mute live alerts" title={muteFutureAlerts ? 'Unmute live alerts' : 'Mute live alerts'} aria-pressed={muteFutureAlerts}>
                {muteFutureAlerts ? <BellOff size={17} /> : <BellRing size={17} />}
              </button>
              <button className="sound-quick" onClick={() => changeSound(!soundEnabled)} aria-label={soundEnabled ? 'Turn sound off' : 'Turn sound on'} aria-pressed={soundEnabled}>
                {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </button>
            </div>
          </div>
          <div className="intro-row">
            <div className="intro-copy">
              <p className="eyebrow">GTA VI <span>·</span> PC PORT RACE</p>
              <h1>Five contenders. One finish line.</h1>
              <p className="intro-subtitle">Live progress toward GTA VI running on PC.</p>
            </div>
            <div className="intro-actions">
              <BackgroundMusic ducked={Boolean(activeAlert)} />
              <button className="preview-button" onClick={() => setPreviewAlert(true)}><BellRing size={16} /> Preview alert</button>
            </div>
          </div>
        </header>

        {(connection !== 'live' || showWarnings) && <div className={`connection-notice ${showWarnings ? 'degraded' : connection}`} role="status">
          <Radio size={17} />
          <div><strong>{showWarnings ? 'Some GitHub data is unavailable' : connection === 'offline' ? 'Portwatch is unreachable' : 'Waiting for Portwatch data'}</strong>
            {showWarnings ? sourceWarnings.map((warning) => <span key={warning}>{warning}</span>) : <span>{error || 'Live race data will appear here once the feed is connected.'}</span>}</div>
          {connection !== 'live' && connection !== 'connecting' && <button className="text-control" disabled={retrying} onClick={retry}>{retrying ? 'Retrying…' : 'Retry now'}</button>}
          {!showWarnings && <a href="https://portwatch-vi.xyz/" target="_blank" rel="noreferrer">Open source <ExternalLink size={13} /></a>}
        </div>}

        <div className="primary-grid">
          <div className="race-column" id="race">
            <div className="section-heading">
              <button className="race-toggle" aria-expanded={raceExpanded} aria-controls="race-standings" onClick={() => setRaceExpanded(!raceExpanded)}>
                <span className="section-kicker">RACE TO PLAYABLE</span><ChevronDown size={15} />
              </button>
              <span>{teams.length ? `${teams.length} teams` : 'No team data'}</span>
            </div>
            <div id="race-standings" hidden={!raceExpanded}><RaceProgress teams={teams} /></div>
            <CurrentPullRequest pullRequests={openPullRequests} />
          </div>
          <div id="pull-requests"><LiveFeed events={feedEvents} /></div>
        </div>

        <div id="teams"><TeamTable teams={teams} /></div>
        <footer className="source-line"><span>Race data: <a href="https://portwatch-vi.xyz/" target="_blank" rel="noreferrer">portwatch-vi.xyz</a></span><span>PR alerts check every 10 seconds · race stats refresh every 5 minutes</span></footer>
      </main>

      <span className="sr-only" role="status" aria-atomic="true">
        {activeAlert && `${previewAlert ? 'Preview. ' : ''}${activeAlert.team} pull request #${activeAlert.number ?? 'unknown'} ${activeAlert.kind}. ${activeAlert.title}`}
      </span>
      <TransientPRAlert key={`${activeAlert?.id ?? 'none'}-${activeAlert?.kind ?? ''}`} event={activeAlert} preview={previewAlert} onDismiss={dismissAlert} />
    </div>
  );
}

function formatUpdated(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'just now';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
