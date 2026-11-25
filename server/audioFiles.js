import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'music.config.json');
const CONTENT_TYPES = {
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.oga': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.weba': 'audio/webm',
  '.webm': 'audio/webm',
};

function configuredTracks() {
  if (!existsSync(CONFIG_PATH)) return [];
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  if (!Array.isArray(config.tracks)) throw new Error('music.config.json must contain a "tracks" array.');
  return config.tracks.map((entry, id) => {
    const track = typeof entry === 'string' ? { path: entry } : entry;
    if (!track || typeof track.path !== 'string' || !track.path.trim()) return null;
    return {
      id: String(id),
      title: typeof track.title === 'string' && track.title.trim()
        ? track.title.trim()
        : path.basename(track.path),
      filePath: path.resolve(PROJECT_ROOT, track.path),
    };
  }).filter(Boolean);
}

export async function audioMiddleware(req, res, next) {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (pathname === '/api/audio/tracks') {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const tracks = await Promise.all(configuredTracks().map(async ({ id, title, filePath }) => {
        try {
          const info = await stat(filePath);
          return info.isFile() && info.size > 0 ? { id, title, available: true } : { id, title, available: false };
        } catch {
          return { id, title, available: false };
        }
      }));
      res.statusCode = 200;
      res.end(JSON.stringify({ tracks }));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ message: error.message || 'Could not read music.config.json.' }));
    }
    return;
  }

  const match = pathname.match(/^\/api\/audio\/([0-9]+)$/);
  if (!match) return next();

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Accept-Ranges', 'bytes');
  try {
    const track = configuredTracks().find((candidate) => candidate.id === match[1]);
    if (!track) {
      res.statusCode = 404;
      res.end('Audio track not found.');
      return;
    }
    const info = await stat(track.filePath);
    if (!info.isFile() || info.size === 0) {
      res.statusCode = 404;
      res.end('Configured audio file not found.');
      return;
    }

    const range = req.headers.range;
    let start = 0;
    let end = info.size - 1;
    if (range) {
      const bytes = range.match(/^bytes=(\d*)-(\d*)$/);
      if (!bytes || (!bytes[1] && !bytes[2])) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${info.size}`);
        res.end();
        return;
      }
      if (!bytes[1]) {
        const suffixLength = Number(bytes[2]);
        start = Math.max(info.size - suffixLength, 0);
      } else {
        start = Number(bytes[1]);
        if (bytes[2]) end = Math.min(Number(bytes[2]), end);
      }
      if (start > end || start >= info.size) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${info.size}`);
        res.end();
        return;
      }
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`);
    } else {
      res.statusCode = 200;
    }

    res.setHeader('Content-Type', CONTENT_TYPES[path.extname(track.filePath).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Content-Length', end - start + 1);
    const stream = createReadStream(track.filePath, { start, end });
    stream.on('error', () => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Could not read the configured audio file.');
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  } catch {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Could not read the configured audio file.');
    } else {
      res.destroy();
    }
  }
}
