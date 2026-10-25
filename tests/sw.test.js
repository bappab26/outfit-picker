import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const listed = [...readFileSync(new URL('sw.js', root), 'utf8').match(/APP_FILES = \[([\s\S]*?)\];/)[1]
  .matchAll(/'([^']+)'/g)].map((m) => m[1]);

function jsFiles(dir) {
  return readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsFiles(`${dir}${e.name}/`) : e.name.endsWith('.js') ? [`${dir}${e.name}`] : []);
}

test('the service worker keeps a copy of every app script', () => {
  for (const file of jsFiles('js/')) assert.ok(listed.includes(file), `${file} missing from APP_FILES in sw.js`);
});

test('every file the service worker lists exists', () => {
  for (const file of listed.filter((f) => !f.startsWith('https://') && f !== './')) {
    assert.ok(existsSync(new URL(file, root)), `${file} listed in sw.js but missing`);
  }
});

test('the service worker caches the same sign-in library as index.html', () => {
  const html = readFileSync(new URL('index.html', root), 'utf8');
  const msal = listed.find((f) => f.startsWith('https://'));
  assert.ok(html.includes(`src="${msal}"`));
});
