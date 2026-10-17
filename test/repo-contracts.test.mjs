import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = relativePath => readFile(resolve(root, relativePath), 'utf8');

test('the root deployment contract is present', async () => {
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './index.html');
  assert.equal(existsSync(resolve(root, 'SmartReader-PWA')), false);
  for (const icon of manifest.icons) await access(resolve(root, icon.src));
});

test('every service-worker cache entry exists', async () => {
  const sw = await read('sw.js');
  const match = sw.match(/const FILES\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, 'service-worker file list is missing');
  const files = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(item => item[1]);
  for (const file of files) {
    if (file !== './') await access(resolve(root, file.replace(/^\.\//, '')));
  }
});

test('reader storage and deep-link contracts remain in the app', async () => {
  const index = await read('index.html');
  assert.match(index, /study-library/);
  assert.match(index, /window\.ENGINE_VER\s*=\s*["'][^"']+["']/);
  assert.match(index, /\(\?:&p=\(\\d\+\)\)\?/);
  assert.match(index, /\(\?:&o=\(\\d\+\)\)\?/);
});

