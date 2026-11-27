import { useCallback, useEffect, useRef, useState } from 'react';
import { BellOff, BellRing, ChevronDown, ExternalLink, Radio, Volume2, VolumeX } from 'lucide-react';
import Broadcast from './components/broadcast/Broadcast.jsx';
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

function isBroadcastRoute() {
  const path = location.pathname.replace(/\/$/, '');
  return path === '' || path === '/index.html' || path === '/broadcast';
}

export default function App() {
  const [broadcast, setBroadcast] = useState(isBroadcastRoute);
  useEffect(() => {
    const sync = () => setBroadcast(isBroadcastRoute());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => {
    if (!broadcast) return;
    const leave = () => {
      history.replaceState(null, '', '/dashboard');
      setBroadcast(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    const key = (event) => { if (event.key === 'Escape') leave(); };
    const fullscreen = () => { if (!document.fullscreenElement) leave(); };
    window.addEventListener('keydown', key);
    document.addEventListener('fullscreenchange', fullscreen);
    return () => {
      window.removeEventListener('keydown', key);
      document.removeEventListener('fullscreenchange', fullscreen);
    };
  }, [broadcast]);
  const startBroadcast = () => {
    history.pushState(null, '', '/broadcast');
    setBroadcast(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const [raceExpanded, setRaceExpanded] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [previewAlert, setPreviewAlert] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('portrace:sound') !== 'off');
  const [muteFutureAlerts, setMuteFutureAlerts] = useState(() => localStorage.getItem('portrace:mute-alerts') === 'on');
  const audioContext = useRef(null);

  const prepareAudio = useCallback(() => {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    audioContext.current ||= new Context();
    return audioContext.current;
  }, []);

  useEffect(() => {
    if (!soundEnabled) return;
    const context = prepareAudio();
    if (!context) return;
    const unlock = () => {
      if (context.state !== 'running') context.resume().catch(() => {});
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      audioContext.current = null;
      context.close().catch(() => {});
    };
  }, [soundEnabled, prepareAudio]);

  const playChime = useCallback((kind = 'opened') => {
    const context = audioContext.current;
    if (!context || context.state !== 'running') return;
    const start = context.currentTime;
    const notes = { closed: [660, 440], merged: [660, 990], position: [440, 550], milestone: [550, 740, 990] };
    (notes[kind] ?? [660, 880]).forEach((frequency, index) => {
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
  }, []);

  const onEvents = useCallback((events) => {
    const kinds = broadcast ? ['opened', 'closed', 'merged', 'milestone', 'position'] : ['opened', 'closed', 'merged'];
    const lifecycleEvents = events.filter((event) => kinds.includes(event.kind));
    if (!lifecycleEvents.length || muteFutureAlerts) return;
    setAlerts((current) => [...current, ...lifecycleEvents].slice(-24));
  }, [broadcast, muteFutureAlerts]);

  const { snapshot, movement, raceNews, connection, error, retry, retrying } = usePortwatch(onEvents);
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

  const sounded = useRef(null);
  useEffect(() => {
    if (!activeAlert) { sounded.current = null; return; }
    if (soundEnabled && sounded.current !== activeAlert) {
      sounded.current = activeAlert;
      playChime(activeAlert.kind);
    }
  }, [soundEnabled, activeAlert, playChime]);
  const airStatus = connection !== 'live'
    ? (snapshot ? 'Cached · reconnecting' : connection === 'connecting' ? 'Connecting' : 'Reconnecting')
    : snapshot?.raceCached ? 'Cached race data' : showWarnings ? 'Partial data' : 'Live';

  const changeSound = (enabled) => {
    setSoundEnabled(enabled);
    localStorage.setItem('portrace:sound', enabled ? 'on' : 'off');
    if (enabled) {
      const context = prepareAudio();
      context?.resume().then(() => playChime()).catch(() => {});
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
    <div className={broadcast ? 'app-shell broadcast' : 'app-shell'}>
      <main id="top" className="dashboard">
        <header className="dashboard-intro">
          <div className="intro-topline">
            <div className="brand"><span className="brand-mark" aria-hidden="true">&gt;_</span><strong>PortRace</strong>{broadcast && <span className="air-subtitle">GTA VI PC port race</span>}</div>
            <div className="intro-status">
              <span className={`live-indicator ${broadcast && airStatus !== 'Live' ? 'offline' : connection}`}><i />{broadcast ? airStatus : connection === 'live' ? 'LIVE' : connection === 'offline' ? 'OFFLINE' : 'WAITING'}</span>
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
              <button className="preview-button broadcast-launch" onClick={startBroadcast}>Broadcast mode</button>
              <button className="preview-button" onClick={() => setPreviewAlert(true)}><BellRing size={16} /> Preview alert</button>
            </div>
          </div>
        </header>

        {broadcast ? <Broadcast snapshot={snapshot} movement={movement} raceNews={raceNews} /> : <>
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
        </>}
      </main>

      <span className="sr-only" role="status" aria-atomic="true">
        {activeAlert && `${previewAlert ? 'Preview. ' : ''}${activeAlert.team} ${activeAlert.number == null ? alertLabels[activeAlert.kind] : `pull request #${activeAlert.number} ${activeAlert.kind}`}. ${activeAlert.title}`}
      </span>
      <TransientPRAlert key={`${activeAlert?.id ?? 'none'}-${activeAlert?.kind ?? ''}`} event={activeAlert} broadcast={broadcast} preview={previewAlert} onDismiss={dismissAlert} />
    </div>
  );
}

const alertLabels = { opened: 'Pull request opened', closed: 'Pull request closed', merged: 'Pull request merged', position: 'Leaderboard change', milestone: 'Milestone reached' };

function formatUpdated(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'just now';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
