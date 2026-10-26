import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_NAME, VERSION } from '../js/ui/labels.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the page turns off zooming', () => {
  const viewport = read('index.html').match(/<meta name="viewport" content="([^"]+)"/)[1];
  assert.match(viewport, /maximum-scale=1/);
  assert.match(viewport, /user-scalable=no/);
  assert.match(read('css/app.css'), /touch-action: manipulation/);
});

test('the page, the home-screen icon and the app start with the same name', () => {
  assert.equal(DEFAULT_NAME, 'lil evil wardrobe');
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, DEFAULT_NAME);
  assert.equal(manifest.short_name, DEFAULT_NAME);
  assert.ok(read('index.html').includes(`<title>${DEFAULT_NAME}</title>`));
});

test('the name is bigger on the opening screen than on the home screen', () => {
  assert.match(read('css/app.css'), /\.signin h1 \{ font-size: 36px; \}/);
});

test('the version is a date', () => {
  assert.match(VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

test('the app, the phone bars, the splash screen and the icons share one background color', () => {
  const bg = read('css/app.css').match(/--bg: (#[0-9a-f]{6})/i)[1].toLowerCase();
  assert.equal(bg, '#29133f');
  assert.equal(read('index.html').match(/<meta name="theme-color" content="([^"]+)"/)[1].toLowerCase(), bg);
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.background_color.toLowerCase(), bg);
  assert.equal(manifest.theme_color.toLowerCase(), bg);
  const [r, g, b] = read('scripts/make-icons.mjs').match(/const BACKGROUND = \[0x(\w\w), 0x(\w\w), 0x(\w\w)\]/).slice(1);
  assert.equal(`#${r}${g}${b}`.toLowerCase(), bg);
});
