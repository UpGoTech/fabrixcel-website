#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const PARTIALS_DIR = path.join(SRC, 'html', 'partials');
const PAGES_DIRS = [
  path.join(SRC, 'html'),
  path.join(SRC, 'html', 'pages'),
];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function parseMeta(content) {
  const meta = { title: 'FabriXcel', page: null };
  const lines = content.split('\n');
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('<!--')) break;
    const titleMatch = line.match(/@title\s+(.+?)\s*-->/);
    const pageMatch = line.match(/@page\s+(.+?)\s*-->/);
    if (titleMatch) meta.title = titleMatch[1];
    if (pageMatch) meta.page = pageMatch[1];
    bodyStart = i + 1;
  }

  return { meta, body: lines.slice(bodyStart).join('\n').trimStart() };
}

function renderPartial(name, vars) {
  let html = read(path.join(PARTIALS_DIR, name));
  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }
  return html;
}

function collectPages() {
  const pages = [];

  for (const dir of PAGES_DIRS) {
    if (!fs.existsSync(dir)) continue;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
      if (entry.name.startsWith('_')) continue;

      const filePath = path.join(dir, entry.name);
      const { meta, body } = parseMeta(read(filePath));
      const outputName = meta.page || entry.name;
      const depth = outputName.includes('/') ? outputName.split('/').length - 1 : 0;
      const root = depth > 0 ? '../'.repeat(depth) : '';

      pages.push({ outputName, title: meta.title, body, root });
    }
  }

  return pages;
}

function build(options = {}) {
  const { quiet = false } = options;

  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
  }

  copyDir(path.join(SRC, 'css'), path.join(DIST, 'css'));
  copyDir(path.join(SRC, 'images'), path.join(DIST, 'images'));

  const pages = collectPages();
  if (pages.length === 0) {
    throw new Error('No pages found in src/html/');
  }

  for (const page of pages) {
    const html = [
      renderPartial('head.html', { title: page.title, root: page.root }),
      renderPartial('header.html', { root: page.root }),
      page.body,
      renderPartial('footer.html', { root: page.root }),
    ].join('\n');

    const outPath = path.join(DIST, page.outputName);
    write(outPath, html);
    if (!quiet) console.log(`  ✓ ${page.outputName}`);
  }

  if (!quiet) console.log(`\nBuilt ${pages.length} page(s) → dist/`);
  return pages.length;
}

if (require.main === module) {
  try {
    build();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { build };
