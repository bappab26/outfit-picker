import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_NAME, VERSION, VERSION_LINE, VERSION_NUMBER } from '../js/ui/labels.js';

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

test('the version line shows the version number, the date and bap bap', () => {
  assert.match(VERSION_NUMBER, /^1\.\d+$/);
  assert.equal(VERSION_LINE, `Version ${VERSION_NUMBER} · ${VERSION} · by bap bap`);
});

test('the version number goes up with the service worker cache', () => {
  const cache = read('sw.js').match(/const CACHE_NAME = 'outfit-picker-v(\d+)'/)[1];
  assert.equal(VERSION_NUMBER, `1.${cache}`);
});

test('the opening screens (sign-in, loading, error) have no version line', () => {
  assert.match(read('js/app.js'), /const NO_VERSION_LINE = \['signin', 'loading', 'error'\];/);
});

test('the version line sits at the bottom of the other screens', () => {
  const css = read('css/app.css');
  const app = css.match(/\n#app \{([^}]*)\}/)[1];
  for (const rule of ['display: flex;', 'flex-direction: column;', 'min-height: 100dvh;']) assert.ok(app.includes(rule), rule);
  assert.match(css, /\.version \{[^}]*margin: auto 0 0;/);
  // Every screen gets its version line from render() in app.js, not from the screen itself.
  for (const file of ['js/ui/home.js', 'js/ui/wardrobe.js', 'js/ui/label.js']) assert.ok(!/versionLine\(|VERSION_LINE/.test(read(file)), file);
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
