import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const viteCli = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const vite = spawn(process.execPath, [viteCli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => vite.kill(signal));
}

vite.on('error', (error) => {
  console.error(`Could not start Vite: ${error.message}`);
  process.exitCode = 1;
});

vite.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
