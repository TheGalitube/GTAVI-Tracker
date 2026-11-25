import { useEffect, useRef, useState } from 'react';
import { Music2, Pause, Play, SkipForward, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'portrace:audio-playlist';
const VOLUME_KEY = 'portrace:audio-volume';
const CURRENT_INDEX_KEY = 'portrace:audio-current-index';
const RESUME_KEY = 'portrace:audio-resume';
const PLAYBACK_KEY = 'portrace:audio-playback-v1';

function readPlayback() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYBACK_KEY));
    if (typeof saved?.track !== 'string') return null;
    return {
      track: saved.track,
      position: Number.isFinite(saved.position) && saved.position >= 0 ? saved.position : 0,
      resume: saved.resume === true,
    };
  } catch {
    return null;
  }
}

function readPlaylist() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((url) => typeof url === 'string') : [];
  } catch {
    return [];
  }
}

function labelFor(url, index) {
  try {
    const file = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) || '');
    return file || `Track ${index + 1}`;
  } catch {
    return `Track ${index + 1}`;
  }
}

function readCurrentIndex() {
  const saved = Number(localStorage.getItem(CURRENT_INDEX_KEY));
  return Number.isInteger(saved) && saved >= 0 ? saved : 0;
}

export default function BackgroundMusic({ ducked = false }) {
  const [urls, setUrls] = useState(readPlaylist);
  const [draft, setDraft] = useState(() => readPlaylist().join('\n'));
  const [localTracks, setLocalTracks] = useState([]);
  const [localTracksLoaded, setLocalTracksLoaded] = useState(false);
  const [localAudioMessage, setLocalAudioMessage] = useState('');
  const [currentIndex, setCurrentIndex] = useState(readCurrentIndex);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = Number(localStorage.getItem(VOLUME_KEY) ?? 0.35);
    return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 0.35;
  });
  const [message, setMessage] = useState('');
  const audioRef = useRef(null);
  const settingsRef = useRef(null);
  const resumeAttempted = useRef(false);
  const playbackRef = useRef(null);

  const savePlayback = () => {
    const playback = playbackRef.current;
    if (!playback) return;
    const audio = audioRef.current;
    if (audio?.readyState && Number.isFinite(audio.duration)) {
      playback.position = audio.currentTime;
    }
    const serialized = JSON.stringify(playback);
    if (localStorage.getItem(PLAYBACK_KEY) !== serialized) {
      localStorage.setItem(PLAYBACK_KEY, serialized);
    }
  };

  useEffect(() => {
    window.addEventListener('pagehide', savePlayback);
    // Checkpoint while the page remains open, including while the server is offline.
    const timer = window.setInterval(savePlayback, 1000);
    return () => {
      window.removeEventListener('pagehide', savePlayback);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    fetch('/api/audio/tracks')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not scan the local music folder.');
        return data;
      })
      .then((data) => {
        if (!stopped) {
          setLocalTracks(Array.isArray(data.tracks) ? data.tracks : []);
          setLocalTracksLoaded(true);
        }
      })
      .catch((error) => {
        if (!stopped) {
          setLocalAudioMessage(error.message || 'Local music is available when running the app with its Vite server.');
          setLocalTracksLoaded(true);
        }
      });
    return () => { stopped = true; };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume * (ducked ? 0.8 : 1);
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume, ducked]);

  const tracks = [
    ...localTracks.map((track) => ({
      key: `local:${track.title}`,
      title: track.title,
      src: `/api/audio/${track.id}`,
      available: track.available,
    })),
    ...urls.map((url, index) => ({
      key: `url:${url}`,
      title: labelFor(url, index),
      src: url,
      available: true,
    })),
  ];

  const playTrack = async (index, position = 0) => {
    const audio = audioRef.current;
    if (!audio || !tracks.length) {
      setMessage('Add audio files to ./music or enter a direct audio URL.');
      return;
    }
    const nextIndex = (index + tracks.length) % tracks.length;
    const track = tracks[nextIndex];
    if (!track.available) {
      setMessage(`Could not read “${track.title}” from ./music. Check that it is not locked by another app.`);
      return;
    }

    resumeAttempted.current = true;
    setCurrentIndex(nextIndex);
    const playback = { track: track.key, position, resume: true };
    playbackRef.current = playback;
    localStorage.setItem(PLAYBACK_KEY, JSON.stringify(playback));
    localStorage.removeItem(CURRENT_INDEX_KEY);
    localStorage.removeItem(RESUME_KEY);

    if (audio.src !== new URL(track.src, window.location.href).href) {
      audio.src = track.src;
      audio.load();
    }
    // Before metadata arrives, currentTime sets the media element's initial seek.
    if (audio.readyState && Number.isFinite(audio.duration)) {
      audio.currentTime = position < audio.duration ? position : 0;
    } else if (!audio.readyState) {
      audio.currentTime = position;
    }
    try {
      await audio.play();
      if (playbackRef.current !== playback || !playback.resume) return;
      setPlaying(true);
      setMessage('');
    } catch (error) {
      if (playbackRef.current !== playback || !playback.resume) return;
      setPlaying(false);
      if (error.name === 'NotAllowedError' && settingsRef.current) settingsRef.current.open = true;
      setMessage(error.name === 'NotAllowedError'
        ? 'The browser blocked autoplay. Press Play to resume music.'
        : 'This audio source could not be played. Check that it is a supported audio file or stream.');
    }
  };

  const pauseMusic = () => {
    audioRef.current?.pause();
    setPlaying(false);
    if (playbackRef.current) {
      playbackRef.current.resume = false;
      savePlayback();
    }
  };

  useEffect(() => {
    if (!localTracksLoaded || resumeAttempted.current) return;
    resumeAttempted.current = true;
    const saved = readPlayback();
    const index = saved
      ? tracks.findIndex((track) => track.key === saved.track && track.available)
      : readCurrentIndex();
    if (!tracks[index]?.available) return;
    setCurrentIndex(index);
    if (saved?.resume || (!saved && localStorage.getItem(RESUME_KEY) === 'on')) {
      playTrack(index, saved?.position);
    } else {
      playbackRef.current = saved;
    }
  }, [localTracksLoaded, tracks.length]);

  const resetPlayback = () => {
    audioRef.current?.pause();
    audioRef.current?.removeAttribute('src');
    audioRef.current?.load();
    playbackRef.current = null;
    localStorage.removeItem(PLAYBACK_KEY);
    localStorage.removeItem(RESUME_KEY);
    localStorage.removeItem(CURRENT_INDEX_KEY);
    setCurrentIndex(0);
    setPlaying(false);
  };

  const savePlaylist = () => {
    const urls = draft.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const value of urls) {
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
        if (/(^|\.)((youtube\.com)|(youtube-nocookie\.com)|(youtu\.be))$/i.test(url.hostname)) {
          setMessage('YouTube links are not direct audio URLs. Use audio file or stream links instead.');
          return;
        }
      } catch {
        setMessage('Each line must be a valid http or https audio URL.');
        return;
      }
    }

    resetPlayback();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
    setUrls(urls);
    setDraft(urls.join('\n'));
    setMessage(`${urls.length} direct ${urls.length === 1 ? 'track' : 'tracks'} saved. Press play to start.`);
  };

  const clearPlaylist = () => {
    resetPlayback();
    localStorage.removeItem(STORAGE_KEY);
    setUrls([]);
    setDraft('');
    setMessage('Direct audio links cleared.');
  };

  const currentTrack = tracks[currentIndex];
  const playCurrent = () => {
    const saved = playbackRef.current;
    playTrack(currentIndex, saved?.track === currentTrack?.key ? saved?.position : 0);
  };

  const finishTrack = () => {
    if (tracks.length > 1) {
      playTrack(currentIndex + 1);
    } else {
      audioRef.current.currentTime = 0;
      pauseMusic();
    }
  };

  return (
    <details className="music-settings" ref={settingsRef}>
      <summary className="preview-button music-settings__trigger"><Music2 size={16} /> Background music <span>{tracks.length ? `${tracks.length} tracks` : 'Set up'}</span></summary>
      <section className="music-settings__panel" aria-label="Background music settings">
        <h2>Audio playlist</h2>
        <p className="music-settings__hint">Put audio files in <code>./music</code>. The local server scans that folder automatically; refresh this page after adding or removing files.</p>
        {localTracks.length > 0 && <p className="music-settings__track">{localTracks.filter((track) => track.available).length} local {localTracks.filter((track) => track.available).length === 1 ? 'track' : 'tracks'} configured</p>}
        {localAudioMessage && <p className="music-settings__message" role="status">{localAudioMessage}</p>}
        {localTracks.some((track) => !track.available) && <p className="music-settings__message" role="status">One or more audio files could not be read. Check that they are supported and not locked by another app.</p>}
        <label htmlFor="audio-playlist">Extra direct audio URLs, one per line</label>
        <textarea
          id="audio-playlist"
          rows={3}
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setMessage(''); }}
          placeholder={'https://example.com/track-one.mp3\nhttps://example.com/track-two.ogg'}
          spellCheck="false"
        />
        <p className="music-settings__hint">Direct audio links are saved in this browser. YouTube links are not supported.</p>
        <div className="music-settings__actions">
          <button className="music-control music-control--primary" onClick={savePlaylist}>Save playlist</button>
          <button className="music-control" onClick={() => playing ? pauseMusic() : playCurrent()} disabled={!localTracksLoaded || !tracks.length} aria-label={playing ? 'Pause music' : 'Play music'}>
            {playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause' : 'Play'}
          </button>
          <button className="music-control" onClick={() => playTrack(currentIndex + 1)} disabled={!localTracksLoaded || tracks.length < 2} aria-label="Play next track"><SkipForward size={15} />Next</button>
          <button className="music-control music-control--icon" onClick={clearPlaylist} disabled={!urls.length} aria-label="Clear direct audio links" title="Clear direct audio links"><Trash2 size={15} /></button>
        </div>
        <div className="music-settings__volume">
          <label htmlFor="audio-volume">Volume</label>
          <input id="audio-volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
          <span>{Math.round(volume * 100)}%</span>
        </div>
        {currentTrack && <p className="music-settings__track" title={currentTrack.title}>{playing ? 'Now playing' : 'Selected'}: {currentTrack.title}</p>}
        {message && <p className="music-settings__message" role="status">{message}</p>}
        <audio ref={audioRef} hidden preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={finishTrack} onError={() => { setPlaying(false); setMessage('Could not load this audio URL. It may be unavailable or not a direct audio stream.'); }} />
      </section>
    </details>
  );
}
