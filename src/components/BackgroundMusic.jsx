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
  const [tracks, setTracks] = useState(readPlaylist);
  const [draft, setDraft] = useState(() => readPlaylist().join('\n'));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 0.35;
  });
  const [message, setMessage] = useState('');
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume]);

  const playTrack = async (index) => {
    const audio = audioRef.current;
    if (!audio || !tracks.length) {
      setMessage('Add at least one audio URL first.');
      return;
    }
    const nextIndex = (index + tracks.length) % tracks.length;
    setCurrentIndex(nextIndex);
    if (audio.src !== tracks[nextIndex]) {
      audio.src = tracks[nextIndex];
      audio.load();
    }
    try {
      await audio.play();
      setPlaying(true);
      setMessage('');
    } catch {
      setPlaying(false);
      setMessage('This audio URL could not be played. Check that it links directly to a supported audio stream or file.');
    }
  };

  const savePlaylist = () => {
    const urls = draft.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!urls.length) {
      setMessage('Paste one or more direct audio URLs, one per line.');
      return;
    }
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
    setTracks(urls);
    setDraft(urls.join('\n'));
    setCurrentIndex(0);
    setPlaying(false);
    setMessage(`${urls.length} ${urls.length === 1 ? 'track' : 'tracks'} saved. Press play to start.`);
  };

  const clearPlaylist = () => {
    audioRef.current?.pause();
    audioRef.current?.removeAttribute('src');
    audioRef.current?.load();
    localStorage.removeItem(STORAGE_KEY);
    setTracks([]);
    setDraft('');
    setCurrentIndex(0);
    setPlaying(false);
    setMessage('Playlist cleared.');
  };

  const currentTrack = tracks[currentIndex];

  return (
    <details className="music-settings">
      <summary className="preview-button music-settings__trigger"><Music2 size={16} /> Background music <span>{tracks.length ? `${tracks.length} tracks` : 'Set up'}</span></summary>
      <section className="music-settings__panel" aria-label="Background music settings">
        <h2>Audio playlist</h2>
        <label htmlFor="audio-playlist">Direct audio URLs</label>
        <textarea
          id="audio-playlist"
          rows={3}
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setMessage(''); }}
          placeholder={'https://example.com/track-one.mp3\nhttps://example.com/track-two.ogg'}
          spellCheck="false"
        />
        <p className="music-settings__hint">Add one audio file or stream URL per line. YouTube links are not supported.</p>
        <div className="music-settings__actions">
          <button className="music-control music-control--primary" onClick={savePlaylist}>Save playlist</button>
          <button className="music-control" onClick={() => playing ? audioRef.current?.pause() : playTrack(currentIndex)} disabled={!tracks.length} aria-label={playing ? 'Pause music' : 'Play music'}>
            {playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause' : 'Play'}
          </button>
          <button className="music-control" onClick={() => playTrack(currentIndex + 1)} disabled={tracks.length < 2} aria-label="Play next track"><SkipForward size={15} />Next</button>
          <button className="music-control music-control--icon" onClick={clearPlaylist} disabled={!tracks.length} aria-label="Clear playlist" title="Clear playlist"><Trash2 size={15} /></button>
        </div>
        <div className="music-settings__volume">
          <label htmlFor="audio-volume">Volume</label>
          <input id="audio-volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
          <span>{Math.round(volume * 100)}%</span>
        </div>
        {currentTrack && <p className="music-settings__track" title={currentTrack}>{playing ? 'Now playing' : 'Selected'}: {labelFor(currentTrack, currentIndex)}</p>}
        {message && <p className="music-settings__message" role="status">{message}</p>}
        <audio ref={audioRef} hidden preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => tracks.length > 1 ? playTrack(currentIndex + 1) : setPlaying(false)} onError={() => { setPlaying(false); setMessage('Could not load this audio URL. It may be unavailable or not a direct audio stream.'); }} />
      </section>
    </details>
  );
}
