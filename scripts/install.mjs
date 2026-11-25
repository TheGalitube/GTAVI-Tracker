import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeMajor = Number(process.versions.node.split('.')[0]);
const supportedNode = nodeMajor === 18 || nodeMajor === 20 || nodeMajor >= 22;

if (!supportedNode) {
  console.error(`Node.js 18, 20, or 22 and newer is required by Vite. Found ${process.versions.node}. Install a supported LTS from https://nodejs.org/ and run this installer again.`);
  process.exit(1);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
console.log('Installing project dependencies...');
const install = spawnSync(npmCommand, ['install'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (install.error || install.status !== 0) {
  console.error(`Dependency installation failed${install.error ? `: ${install.error.message}` : '.'}`);
  process.exit(install.status || 1);
}

mkdirSync(path.join(projectRoot, 'music'), { recursive: true });

const localEnv = path.join(projectRoot, '.env.local');
const existingEnv = path.join(projectRoot, '.env');
const exampleEnv = path.join(projectRoot, '.env.example');
if (!existsSync(localEnv) && !existsSync(existingEnv) && existsSync(exampleEnv)) {
  copyFileSync(exampleEnv, localEnv);
  console.log('Created .env.local from .env.example. Add a GitHub token there if you use one.');
}

console.log('\nSetup complete. Put audio files in ./music, then start the app with:');
console.log('  npm run dev');
