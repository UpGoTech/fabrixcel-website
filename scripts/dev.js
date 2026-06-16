#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const PORT = process.env.PORT || 3000;

const ASSET_EXT = /\.(html|css|svg|png|jpe?g|gif|webp|ico)$/i;

let building = false;
let pending = false;

function runBuild() {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  try {
    build({ quiet: true });
    process.stdout.write('\r\x1b[K✓ Rebuilt — refreshing browser\n');
  } catch (err) {
    console.error('\n✗ Build failed:', err.message);
  }
  building = false;
  if (pending) {
    pending = false;
    runBuild();
  }
}

const scheduleBuild = (() => {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(runBuild, 200);
  };
})();

console.log('Building...');
try {
  build();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

function watchDir(dir) {
  fs.watch(dir, { recursive: true }, (_, filename) => {
    if (!filename || path.basename(filename).startsWith('.')) return;
    if (!ASSET_EXT.test(filename)) return;
    process.stdout.write(`\n↻ ${filename} changed`);
    scheduleBuild();
  });
}

try {
  watchDir(SRC);
  console.log(`\nWatching src/ — live preview at http://localhost:${PORT}\n`);
} catch {
  for (const sub of ['html', 'css', 'images']) {
    const dir = path.join(SRC, sub);
    if (fs.existsSync(dir)) watchDir(dir);
  }
  console.log(`\nWatching src/ subfolders — live preview at http://localhost:${PORT}\n`);
}

const server = spawn(
  'npx',
  [
    '--yes', 'browser-sync', 'start',
    '--server', 'dist',
    '--files', 'dist/**/*',
    '--port', String(PORT),
    '--no-open',
    '--ghost-mode', 'false',
  ],
  { stdio: 'inherit', cwd: ROOT, shell: true },
);

server.on('exit', (code) => process.exit(code ?? 0));

process.on('SIGINT', () => {
  server.kill('SIGINT');
  process.exit(0);
});
