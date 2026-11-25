import { defineConfig } from 'vite';
import { getPortwatchSnapshot } from './server/portwatchSource.js';

async function portwatchMiddleware(req, res, next) {
  if (req.url?.split('?')[0] !== '/api/portwatch') return next();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const snapshot = await getPortwatchSnapshot();
    res.statusCode = 200;
    res.end(JSON.stringify(snapshot));
  } catch (error) {
    res.statusCode = 502;
    res.end(JSON.stringify({ message: error.message || 'Unable to read live tracker data.' }));
  }
}

function portwatchPlugin() {
  const attach = (server) => { server.middlewares.use(portwatchMiddleware); };
  return {
    name: 'portwatch-live-data',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  plugins: [portwatchPlugin()],
  esbuild: { jsx: 'automatic' },
  server: { host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
});
