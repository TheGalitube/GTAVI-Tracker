import { useEffect, useRef, useState } from 'react';
import { Music2, Pause, Play, SkipForward, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'portrace:audio-playlist';
const VOLUME_KEY = 'portrace:audio-volume';

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

export default function BackgroundMusic() {
  const [urls, setUrls] = useState(readPlaylist);
  const [draft, setDraft] = useState(() => readPlaylist().join('\n'));
  const [localTracks, setLocalTracks] = useState([]);
  const [localConfigMessage, setLocalConfigMessage] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 0.35;
  });
  const [message, setMessage] = useState('');
  const audioRef = useRef(null);

  useEffect(() => {
    let stopped = false;
    fetch('/api/audio/tracks')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not read local music configuration.');
        return data;
      })
      .then((data) => {
        if (!stopped) setLocalTracks(Array.isArray(data.tracks) ? data.tracks : []);
      })
      .catch((error) => {
        if (!stopped) setLocalConfigMessage(error.message || 'Local file paths are available when running the app with its Vite server.');
      });
    return () => { stopped = true; };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume]);

  const tracks = [
    ...localTracks.map((track) => ({
      id: `local-${track.id}`,
      title: track.title,
      src: `/api/audio/${track.id}`,
      available: track.available,
    })),
    ...urls.map((url, index) => ({
      id: `url-${index}`,
      title: labelFor(url, index),
      src: url,
      available: true,
    })),
  ];

  const playTrack = async (index) => {
    const audio = audioRef.current;
    if (!audio || !tracks.length) {
      setMessage('Add at least one audio URL first.');
      return;
    }
    const nextIndex = (index + tracks.length) % tracks.length;
    if (!tracks[nextIndex].available) {
      setCurrentIndex(nextIndex);
      setMessage(`The configured file “${tracks[nextIndex].title}” was not found. Check its path in music.config.json.`);
      return;
    }
    setCurrentIndex(nextIndex);
    if (audio.src !== new URL(tracks[nextIndex].src, window.location.href).href) {
      audio.src = tracks[nextIndex].src;
      audio.load();
    }
    try {
      await audio.play();
      setPlaying(true);
      setMessage('');
    } catch {
      setPlaying(false);
      setMessage('This audio source could not be played. Check that it is a supported audio file or stream.');
    }
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

    audioRef.current?.pause();
    if (audioRef.current) {
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
    setUrls(urls);
    setDraft(urls.join('\n'));
    setCurrentIndex(0);
    setPlaying(false);
    setMessage(`${urls.length} direct ${urls.length === 1 ? 'track' : 'tracks'} saved. Press play to start.`);
  };

  const clearPlaylist = () => {
    audioRef.current?.pause();
    audioRef.current?.removeAttribute('src');
    audioRef.current?.load();
    localStorage.removeItem(STORAGE_KEY);
    setUrls([]);
    setDraft('');
    setCurrentIndex(0);
    setPlaying(false);
    setMessage('Direct audio links cleared.');
  };

  const currentTrack = tracks[currentIndex];

  return (
    <details className="music-settings">
      <summary className="preview-button music-settings__trigger"><Music2 size={16} /> Background music <span>{tracks.length ? `${tracks.length} tracks` : 'Set up'}</span></summary>
      <section className="music-settings__panel" aria-label="Background music settings">
        <h2>Audio playlist</h2>
        <p className="music-settings__hint">Local files are read from <code>music.config.json</code> in the project folder. Copy <code>music.config.example.json</code> and set each file path there.</p>
        {localTracks.length > 0 && <p className="music-settings__track">{localTracks.filter((track) => track.available).length} local {localTracks.filter((track) => track.available).length === 1 ? 'track' : 'tracks'} configured</p>}
        {localConfigMessage && <p className="music-settings__message" role="status">{localConfigMessage}</p>}
        {localTracks.some((track) => !track.available) && <p className="music-settings__message" role="status">One or more configured files could not be found. Check the paths in music.config.json.</p>}
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
          <button className="music-control" onClick={() => playing ? audioRef.current?.pause() : playTrack(currentIndex)} disabled={!tracks.length} aria-label={playing ? 'Pause music' : 'Play music'}>
            {playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause' : 'Play'}
          </button>
          <button className="music-control" onClick={() => playTrack(currentIndex + 1)} disabled={tracks.length < 2} aria-label="Play next track"><SkipForward size={15} />Next</button>
          <button className="music-control music-control--icon" onClick={clearPlaylist} disabled={!urls.length} aria-label="Clear direct audio links" title="Clear direct audio links"><Trash2 size={15} /></button>
        </div>
        <div className="music-settings__volume">
          <label htmlFor="audio-volume">Volume</label>
          <input id="audio-volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
          <span>{Math.round(volume * 100)}%</span>
        </div>
        {currentTrack && <p className="music-settings__track" title={currentTrack.title}>{playing ? 'Now playing' : 'Selected'}: {currentTrack.title}</p>}
        {message && <p className="music-settings__message" role="status">{message}</p>}
        <audio ref={audioRef} hidden preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => tracks.length > 1 ? playTrack(currentIndex + 1) : setPlaying(false)} onError={() => { setPlaying(false); setMessage('Could not load this audio URL. It may be unavailable or not a direct audio stream.'); }} />
      </section>
    </details>
  );
}
