import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MUSIC_DIR = path.join(PROJECT_ROOT, 'music');
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

async function localTracks() {
  let files;
  try {
    files = await readdir(MUSIC_DIR, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return files
    .filter((file) => file.isFile() && CONTENT_TYPES[path.extname(file.name).toLowerCase()])
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((file, id) => ({ id: String(id), title: file.name, filePath: path.join(MUSIC_DIR, file.name) }));
}

export async function audioMiddleware(req, res, next) {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (pathname === '/api/audio/tracks') {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const tracks = await Promise.all((await localTracks()).map(async ({ id, title, filePath }) => {
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
      res.end(JSON.stringify({ message: error.message || 'Could not scan the local music folder.' }));
    }
    return;
  }

  const match = pathname.match(/^\/api\/audio\/([0-9]+)$/);
  if (!match) return next();

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Accept-Ranges', 'bytes');
  try {
    const track = (await localTracks()).find((candidate) => candidate.id === match[1]);
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
