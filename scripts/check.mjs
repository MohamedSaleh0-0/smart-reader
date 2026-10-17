import { access, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function fail(message) {
  failures.push(message);
}

async function requireFile(relativePath) {
  const absolutePath = resolve(root, relativePath);
  try {
    await access(absolutePath);
  } catch {
    fail(`missing required path: ${relativePath}`);
  }
}

const required = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'fonts.css',
  'fonts/f1.ttf',
  'fonts/f2.ttf',
  'fonts/f3.ttf',
  'fonts/f4.ttf',
  'fonts/f5.ttf',
  'fonts/f6.ttf',
  'fonts/f7.ttf',
  'fonts/f8.ttf',
  'lib/pdf.min.js',
  'lib/pdf.worker.min.js',
  'sr-mcp.js',
];

for (const path of required) await requireFile(path);

if (existsSync(resolve(root, 'SmartReader-PWA'))) fail('obsolete SmartReader-PWA directory still exists');

const manifest = JSON.parse(await readFile(resolve(root, 'manifest.webmanifest'), 'utf8'));
for (const icon of manifest.icons || []) await requireFile(icon.src);

const sw = await readFile(resolve(root, 'sw.js'), 'utf8');
const cacheMatch = sw.match(/const CACHE\s*=\s*['"](smart-reader-v\d+)['"]/);
if (!cacheMatch) fail('service worker cache version is missing or malformed');
const fileListMatch = sw.match(/const FILES\s*=\s*\[([\s\S]*?)\];/);
if (!fileListMatch) {
  fail('service worker file list is missing or malformed');
} else {
  const cachedFiles = [...fileListMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]);
  for (const file of cachedFiles) {
    if (file === './') continue;
    await requireFile(file.replace(/^\.\//, ''));
  }
}

const index = await readFile(resolve(root, 'index.html'), 'utf8');
if (!/window\.ENGINE_VER\s*=\s*["'][^"']+["']/.test(index)) fail('ENGINE_VER is missing');
if (!index.includes('study-library')) fail('IndexedDB database contract is missing');
if (!index.includes('(?:&p=(\\d+))?')) fail('deep-link page regex contract is missing');
if (!index.includes('(?:&o=(\\d+))?')) fail('deep-link ordinal regex contract is missing');

const syntax = spawnSync(process.execPath, ['--check', resolve(root, 'sr-mcp.js')], { encoding: 'utf8' });
if (syntax.status !== 0) fail(`sr-mcp.js syntax check failed: ${syntax.stderr || syntax.stdout}`.trim());

if (failures.length) {
  console.error('Repository checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Repository checks passed.');
}

