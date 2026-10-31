import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_NAME, VERSION_LINE, VERSION_NUMBER } from '../js/ui/labels.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the page turns off zooming', () => {
  const viewport = read('index.html').match(/<meta name="viewport" content="([^"]+)"/)[1];
  assert.match(viewport, /maximum-scale=1/);
  assert.match(viewport, /user-scalable=no/);
  // Up-and-down scrolling only: no double-tap or pinch zoom, and sideways swipes go back.
  assert.match(read('css/app.css'), /html \{[^}]*touch-action: pan-y;/);
});

test('the page, the home-screen icon and the app start with the same name', () => {
  assert.equal(DEFAULT_NAME, 'lil evil');
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, DEFAULT_NAME);
  assert.equal(manifest.short_name, DEFAULT_NAME);
  assert.ok(read('index.html').includes(`<title>${DEFAULT_NAME}</title>`));
  assert.ok(read('index.html').includes(`<meta name="apple-mobile-web-app-title" content="${DEFAULT_NAME}">`), 'iPhone home-screen title');
});

test('the name is bigger on the opening screen than on the home screen', () => {
  assert.match(read('css/app.css'), /\.signin h1 \{ font-size: 36px; \}/);
});

test('the version line shows just the version number and bap bap', () => {
  assert.match(VERSION_NUMBER, /^1\.\d+$/);
  assert.equal(VERSION_LINE, `${VERSION_NUMBER} · by bap bap`);
});

test('every screen has a leopard print behind it, with spots in each look\'s colors', () => {
  const css = read('css/app.css');
  const rule = (selector) => css.match(new RegExp(`(?:^|\\n)${selector.replace('.', '\\.')} \\{([^}]*)\\}`))[1];
  const spots = (selector) => rule(selector).match(/--leopard: url\("data:image\/svg\+xml,([^"]+)"\)/)[1];
  // The spots only: the background color shows through around them.
  const looks = { ':root': ['%233b2259', '%23170824'], 'body.evil': ['%232e0b12', '%230f0204'], 'body.angel': ['%23ece0f8', '%23d9c6ee'] };
  for (const [selector, colors] of Object.entries(looks)) {
    for (const color of colors) assert.ok(spots(selector).includes(color), `${selector}: ${color}`);
    assert.ok(!/rect/.test(spots(selector)), selector);
  }
  assert.match(rule('body'), /background: var\(--leopard\) 0 0 \/ 112px, var\(--bg\);/);
  assert.match(rule('body.evil'), /no-repeat, var\(--leopard\) 0 0 \/ 112px, var\(--bg\);/, 'the red glow keeps the spots');
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
  const app = css.match(/\n#app(?:, [^{]+)? \{([^}]*)\}/)[1];
  for (const rule of ['display: flex;', 'flex-direction: column;', 'min-height: 100dvh;']) assert.ok(app.includes(rule), rule);
  assert.match(css, /\.version \{[^}]*margin: auto 0 0;/);
  // Every screen gets its version line from drawScreen() in app.js, not from the screen itself.
  for (const file of ['js/ui/home.js', 'js/ui/wardrobe.js', 'js/ui/label.js']) assert.ok(!/versionLine\(|VERSION_LINE/.test(read(file)), file);
});

test('evil mode turns every screen blood red, the phone bars too', () => {
  const evil = read('css/app.css').match(/\nbody\.evil \{([^}]*)\}/)[1];
  for (const color of ['--bg: #1c0609;', '--surface: #3a0f17;', '--accent: #ff3355;']) assert.ok(evil.includes(color), color);
  // The phone's top bar takes --bg from the body (applyTheme in app.js).
  assert.match(read('js/app.js'), /getComputedStyle\(document\.body\)\.getPropertyValue\('--bg'\)/);
});

test('the outfit calendar sits on a plain panel, so the leopard print stays out of the way', () => {
  const css = read('css/app.css');
  assert.match(css, /\n\.calendar-box \{[^}]*background: var\(--surface\);/);
  assert.match(css, /\n\.day\.worn \{ background: var\(--accent-soft\);/, 'worn days stand out from the panel');
  assert.match(read('js/ui/worn.js'), /h\('section', \{ class: 'calendar-box' \}/);
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
