# Outfit Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free phone web app that reads clothing photos from OneDrive `Wardrobe` folders and suggests 3 outfits using plain code rules.

**Architecture:** A static site (plain HTML, CSS and ES modules, no build step) hosted on GitHub Pages. Pure logic modules (dates, colors, rules, feedback, store, sources) are tested with Node's built-in test runner; browser-only parts (MSAL sign-in, canvas color detection, screens) sit on top. Data lives in `data.json` in the app's OneDrive folder; sample mode keeps the same data in `localStorage`.

**Tech Stack:** HTML, CSS, JavaScript ES modules; `@azure/msal-browser` 4.30.0 from jsDelivr; Microsoft Graph v1.0; Node.js 24 LTS (dev only: `node --test` and a local static server).

**Spec:** `docs/superpowers/specs/2026-10-25-outfit-picker-design.md`

## Global Constraints

- $0 to run: no paid services, no server, no runtime dependency other than MSAL.
- MSAL is loaded only with this tag, which defines the global `msal`:
  `<script src="https://cdn.jsdelivr.net/npm/@azure/msal-browser@4.30.0/lib/msal-browser.min.js" integrity="sha384-RGxxfG5yRS8DLU7ZJ8OoLhbV/BsJFHyPuMVHrTLbpj3t5Z15LnviJmaznKY/a7LZ" crossorigin="anonymous"></script>`
- Plain HTML, CSS and JavaScript ES modules. No framework, no bundler, no build step. `package.json` has no `dependencies` or `devDependencies`.
- Node.js 24 LTS is a dev tool only (tests, local server, icon script). App code never imports Node modules.
- Interface copy is English.
- Phone first: usable at 320px wide with no horizontal scrolling; tap targets at least 44px; works in iOS Safari and Android Chrome.
- Every rule number lives in `js/settings.js`. No numeric rule values inside `js/rules.js` or `js/feedback.js`.
- These modules must import in Node without a browser (no DOM, `window`, `localStorage` or `location` use at import time; dates and randomness are passed in): `js/config.js`, `js/settings.js`, `js/dates.js`, `js/keys.js`, `js/colors.js` (only `detectImageColor` touches the browser, and only when called), `js/rules.js`, `js/feedback.js`, `js/store.js`, `js/sample.js`, `js/sources.js`, `js/onedrive.js`.
- OneDrive layout is exact: folder `Wardrobe` at the drive root with subfolders `Tops`, `Pants`, `Skirts`, `Dresses`, `Shoes`, `Outerwear`; data file `data.json` in the app folder (`/me/drive/special/approot`).
- Sign-in: authority `https://login.microsoftonline.com/common`, scope `Files.ReadWrite`, redirect flow, token cache in `localStorage`.
- The local server listens on port 8080, so the local redirect address is `http://localhost:8080/`.
- Dates are local calendar dates as `YYYY-MM-DD` strings, never UTC.
- `localStorage` keys: `outfit-picker:mode`, `outfit-picker:sample`, `outfit-picker:pending`.
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **"Wore this" in the evening.** In Quebec (UTC−4/−5), `new Date().toISOString()` is already the next day after 8 pm. The recorded date must be the local date. Test in Task 2.
2. **A real-sized wardrobe.** About 90 labeled pieces in Mild (outerwear optional) gives around 125,000 combinations. Picking must stay fast. Test in Task 5 (under 500 ms in Node).
3. **A hand-edited, old or damaged `data.json`.** Missing fields, unknown colors or wrong types must load without crashing; affected pieces become unlabeled. Test in Task 7.
4. **Real OneDrive folders.** Videos or PDFs mixed in with the photos, and more than 200 photos in one folder (Graph returns pages). Only images are kept, from every page. Test in Task 11.
5. **Small wardrobes and Shuffle.** With only 1 or 2 possible outfits, show those; when Shuffle has nothing new, show the same outfits again instead of an empty screen. Test in Task 5.

---

## Shared types

Used across tasks; each task's Interfaces block refers to these names.

```
Color        one of COLORS in js/colors.js
Category     'tops' | 'pants' | 'skirts' | 'dresses' | 'shoes' | 'outerwear'
Item         { id, category, fileName, color: Color|null, warmth: 'light'|'medium'|'warm'|null,
               style: 'casual'|'smart'|'dressy'|null, addedAt: 'YYYY-MM-DD',
               lastWorn: 'YYYY-MM-DD'|null, wearCount: number }
Data         spec §4.5: { version: 1, items: { [id]: Item without id }, pairScores: { [pairKey]: number },
               outfitPenalties: { [outfitKey]: number },
               settings: { occasion, temperature, somethingDifferent } }
Outfit       { key: string (outfitKey of its ids), items: Item[] (in CATEGORIES order) }
ListingEntry { id, category, fileName, thumbUrl: string|null }
NoteCode     'add-shoes' | 'add-main' | 'no-match' | 'add-coat' | 'all-recent'
Source       { mode: 'sample'|'onedrive', load(): Promise<{ data: Data, newIds: string[] }>,
               refresh(data: Data): Promise<{ newIds: string[] }>,
               photoUrl(id: string): string|null, save(text: string): Promise<void> }
```

## File map

| File | Responsibility | Task |
|---|---|---|
| `package.json`, `.gitignore`, `.claude/launch.json` | Test and serve commands; browser-pane launch config | 1 |
| `scripts/serve.mjs` | Local static server on port 8080 | 1 |
| `js/config.js` | Microsoft app ID, sign-in constants, folder names | 1 |
| `tools/probe.html`, `tools/probe.js` | One-off checks of the three spec §8 risks | 1 |
| `README.md` | Setup guide (Task 1), completed in Task 13 | 1, 13 |
| `docs/superpowers/probe-results.md` | Probe results and the two decisions they drive | 1 |
| `js/dates.js`, `js/keys.js` | Local dates; pair and outfit keys | 2 |
| `js/settings.js` | All rule numbers | 3 |
| `js/colors.js` | Color list, wheel, pixel naming, photo color detection | 3 |
| `js/rules.js` | Build and filter outfits (Task 4); score and pick (Task 5) | 4, 5 |
| `js/feedback.js` | 👍, 👎 and Wore this | 6 |
| `js/store.js` | Data shape, repair, merge with OneDrive listing, debounced saver | 7 |
| `js/sample.js` | Sample wardrobe and its drawings | 8 |
| `js/sources.js` | Sample source (Task 8), OneDrive source (Task 12) | 8, 12 |
| `index.html`, `css/app.css`, `js/app.js`, `js/ui/dom.js`, `js/ui/home.js` | Page shell, app state, home screen | 9 |
| `js/ui/label.js`, `js/ui/wardrobe.js` | Labeling and wardrobe screens | 10 |
| `js/onedrive.js` | Microsoft Graph calls | 11 |
| `js/auth.js` | MSAL wrapper | 12 |
| `manifest.webmanifest`, `sw.js`, `scripts/make-icons.mjs`, `icons/` | Home-screen install and offline app shell | 13 |
| `tests/*.test.js`, `tests/helpers.js` | Automated checks | 2–12 |

**Dependency note:** Tasks 2–10 do not depend on the Task 1 checkpoint and may proceed while the builder runs the probe. Tasks 11–13 need its results.

---

### Task 1: Setup guide, local server and OneDrive probe

**Files:**
- Create: `package.json`, `.gitignore`, `.claude/launch.json`, `scripts/serve.mjs`, `js/config.js`, `tools/probe.html`, `tools/probe.js`, `README.md`, `docs/superpowers/probe-results.md`

**Interfaces:**
- Produces: `npm test` runs `node --test`; `npm run serve` runs `node scripts/serve.mjs`.
- Produces `js/config.js`:
  - `CLIENT_ID_PLACEHOLDER = 'PASTE-YOUR-APP-ID-HERE'`, `CLIENT_ID = CLIENT_ID_PLACEHOLDER`
  - `AUTHORITY = 'https://login.microsoftonline.com/common'`, `SCOPES = ['Files.ReadWrite']`
  - `WARDROBE_FOLDER = 'Wardrobe'`, `DATA_FILE = 'data.json'`
  - `FOLDERS = { Tops: 'tops', Pants: 'pants', Skirts: 'skirts', Dresses: 'dresses', Shoes: 'shoes', Outerwear: 'outerwear' }` (key order is the wardrobe screen order)
  - `redirectUri(): string` → `location.origin + location.pathname` with a trailing `index.html` removed (reads `location` only when called)
- Produces `docs/superpowers/probe-results.md` with two decisions: `IMAGE_STRATEGY: thumbnail | download` and `IOS_HOME_SCREEN_SIGNIN: redirect | popup | safari-only`.

- [ ] **Step 1: Create `package.json` and `.gitignore`**

`package.json`: `{ "name": "outfit-picker", "private": true, "type": "module", "scripts": { "test": "node --test", "serve": "node scripts/serve.mjs" } }`. `.gitignore`: `node_modules/`.

- [ ] **Step 2: Write `scripts/serve.mjs` and `.claude/launch.json`**

`node:http` static server for the repo root on port 8080: `/` and directory paths serve their `index.html`; MIME types for `.html .js .mjs .css .json .webmanifest .png .svg .md`; any path resolving outside the repo root → 403; missing file → 404; every response sends `Cache-Control: no-store`.
`.claude/launch.json`: `{ "version": "0.0.1", "configurations": [ { "name": "outfit-picker", "runtimeExecutable": "node", "runtimeArgs": ["scripts/serve.mjs"], "port": 8080 } ] }`.

- [ ] **Step 3: Write `js/config.js`** as in Interfaces.

- [ ] **Step 4: Write `tools/probe.html` and `tools/probe.js`**

`probe.html`: viewport meta, `<meta name="apple-mobile-web-app-capable" content="yes">`, the MSAL tag from Global Constraints, `<script type="module" src="probe.js">`, buttons **Sign in (redirect)**, **Sign in (popup)**, **Run checks**, and `<pre id="log">`. `probe.js` imports `js/config.js` (its `redirectUri()` gives the probe's own address) and prints `PASS` or `FAIL` plus details for each check:

1. Mode: whether `matchMedia('(display-mode: standalone)')` matches, and `navigator.standalone`.
2. Signed in: account username after `handleRedirectPromise()` or the popup.
3. Folder: create `Wardrobe` and `Wardrobe/Tops` if missing (POST, 409 counts as success), then list `Wardrobe/Tops` with `$expand=thumbnails`; print the image count. If 0, print "Add one photo to Wardrobe/Tops in OneDrive and run the checks again".
4. Thumbnail pixels: `fetch(thumbnails[0].medium.url)` → blob → `createImageBitmap` → canvas `getImageData(0, 0, 1, 1)`.
5. Download pixels: GET `/me/drive/items/{id}?$select=id,@microsoft.graph.downloadUrl`, fetch that URL without an Authorization header, then read one pixel the same way.
6. App folder: PUT `/me/drive/special/approot:/probe.json:/content` with `{"ok":true}`, GET it back and compare.

- [ ] **Step 5: Verify the server**

Run `npm run serve` in the background, then:
`curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/tools/probe.html` → `200`
`curl -s -o /dev/null -w "%{http_code}" --path-as-is http://localhost:8080/../package.json` → `403` or `404`
Stop the server.

- [ ] **Step 6: Write the README "Setup" section from Microsoft's current docs**

First read the current Microsoft Learn pages "Register an application with the Microsoft identity platform" and "Single-page application: App registration", then write the steps as they are today, including whether a personal Microsoft account must first create a free Azure account and whether that asks for a card (spec §8.3). The steps cover:
- Register an app named `Outfit Picker` (this name becomes the OneDrive folder `Apps/Outfit Picker`); supported accounts "Accounts in any organizational directory and personal Microsoft accounts"; platform "Single-page application".
- Redirect URIs: `http://localhost:8080/`, `http://localhost:8080/tools/probe.html`, `https://<github-user>.github.io/<repo>/`, `https://<github-user>.github.io/<repo>/tools/probe.html`.
- API permission: Microsoft Graph, delegated, `Files.ReadWrite`.
- Copy the Application (client) ID into `CLIENT_ID` in `js/config.js`.
- Install Node.js LTS; run locally with `npm run serve` and open `http://localhost:8080/`.
- Create a GitHub repository, push, then Settings → Pages → Deploy from branch `main`, folder `/ (root)`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: add setup guide, local server and OneDrive probe"
```

- [ ] **Step 8: Checkpoint: the builder runs the probe**

The builder follows the README Setup section, then runs the probe:
(a) on the computer at `http://localhost:8080/tools/probe.html` with redirect sign-in;
(b) on the friend's type of phone (iPhone Safari or Android Chrome) at the GitHub Pages address;
(c) on that phone from a home-screen icon, trying redirect first, then popup.
Record every check's result in `docs/superpowers/probe-results.md`, then the decisions:
- `IMAGE_STRATEGY: thumbnail` if check 4 passes everywhere; otherwise `download` if check 5 passes. If both fail, stop and revisit spec §4.4.
- `IOS_HOME_SCREEN_SIGNIN: redirect` if (c) passes with redirect; otherwise `popup` if (c) passes with popup; otherwise `safari-only`.
- If check 6 fails, stop and revisit spec §4.5.
Commit with `git commit -m "docs: record OneDrive probe results"`.

---

### Task 2: Dates and keys

**Files:**
- Create: `js/dates.js`, `js/keys.js`
- Test: `tests/dates.test.js`, `tests/keys.test.js`

**Interfaces:**
- Produces `js/dates.js`: `todayISO(date = new Date()): string` (local calendar date, `YYYY-MM-DD`); `daysBetween(fromISO: string, toISO: string): number` (whole calendar days from → to, negative when `toISO` is earlier, unaffected by daylight-saving changes).
- Produces `js/keys.js`: `pairKeys(ids: string[]): string[]` (every unordered pair once, each `"a|b"` with `a < b` in string order); `outfitKey(ids: string[]): string` (ids sorted, joined with `|`).

- [ ] **Step 1: Write the failing tests**

```js
// tests/dates.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayISO, daysBetween } from '../js/dates.js';

test('todayISO uses the local calendar date, even late in the evening', () => {
  assert.equal(todayISO(new Date(2026, 9, 25, 23, 30)), '2026-10-25');
  assert.equal(todayISO(new Date(2026, 0, 5, 0, 5)), '2026-01-05');
});
test('daysBetween counts calendar days across a daylight-saving change', () => {
  assert.equal(daysBetween('2026-10-31', '2026-11-02'), 2);
  assert.equal(daysBetween('2026-10-25', '2026-10-25'), 0);
  assert.equal(daysBetween('2026-10-25', '2026-10-20'), -5);
});

// tests/keys.test.js
import { pairKeys, outfitKey } from '../js/keys.js';
test('pairKeys lists each unordered pair once with sorted ids', () => {
  assert.deepEqual(pairKeys(['c', 'a', 'b']).sort(), ['a|b', 'a|c', 'b|c']);
  assert.deepEqual(pairKeys(['a']), []);
});
test('outfitKey does not depend on order', () => {
  assert.equal(outfitKey(['c', 'a', 'b']), 'a|b|c');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL, `Cannot find module` for `js/dates.js` and `js/keys.js`.

- [ ] **Step 3: Implement `js/dates.js` and `js/keys.js`**

`todayISO` builds the string from `getFullYear()`, `getMonth()` and `getDate()`. `daysBetween` compares `Date.UTC(y, m - 1, d)` of both dates.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add js/dates.js js/keys.js tests/dates.test.js tests/keys.test.js
git commit -m "feat: add local dates and outfit keys"
```

---

### Task 3: Settings and colors

**Files:**
- Create: `js/settings.js`, `js/colors.js`
- Test: `tests/colors.test.js`

**Interfaces:**
- Produces `js/settings.js`:
  ```js
  export const SETTINGS = {
    suggestions: 3,
    maxBoldColors: 2,
    colorPoints: { neutral: 2, same: 1, adjacent: 1, opposite: 1, other: -2 },
    taste: { like: 1, dislike: -1, wore: 0.5, dislikeOutfit: -5 },
    recentDays: 3, recentPenalty: -3,
    forgottenDays: 30, forgottenBonus: 4,
    randomMax: 1.5,
    saveDelayMs: 1000,
  };
  ```
- Produces `js/colors.js`:
  - `NEUTRALS = ['black', 'white', 'grey', 'beige', 'brown', 'navy', 'denim']`
  - `BOLDS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']` (wheel order; pink wraps to red)
  - `COLORS = [...NEUTRALS, ...BOLDS]`
  - `SWATCHES: Record<Color, string>`: a hex value per color (the implementer picks them, e.g. navy `#1f2a44`, denim `#4f6d8f`)
  - `isNeutral(color): boolean`
  - `wheelDistance(a, b): 0 | 1 | 2 | 3` (bold colors only)
  - `pairColorPoints(a, b): number` (spec §3.4 table, values from `SETTINGS.colorPoints`)
  - `nameColor(r, g, b): Color`
  - `detectColor(rgba: Uint8ClampedArray, width: number, height: number): Color`
  - `detectImageColor(blob: Blob): Promise<Color>` (browser only)

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, SWATCHES, wheelDistance, pairColorPoints, nameColor, detectColor } from '../js/colors.js';

test('wheel distance wraps around', () => {
  assert.equal(wheelDistance('red', 'orange'), 1);
  assert.equal(wheelDistance('pink', 'red'), 1);
  assert.equal(wheelDistance('red', 'green'), 3);
  assert.equal(wheelDistance('yellow', 'purple'), 3);
  assert.equal(wheelDistance('red', 'yellow'), 2);
});
test('pair color points follow the spec table', () => {
  assert.equal(pairColorPoints('navy', 'red'), 2);
  assert.equal(pairColorPoints('black', 'white'), 2);
  assert.equal(pairColorPoints('red', 'red'), 1);
  assert.equal(pairColorPoints('red', 'orange'), 1);
  assert.equal(pairColorPoints('orange', 'blue'), 1);
  assert.equal(pairColorPoints('red', 'yellow'), -2);
});
test('nameColor maps sample pixels to color names', () => {
  const cases = [
    [[0, 0, 0], 'black'], [[255, 255, 255], 'white'], [[128, 128, 128], 'grey'],
    [[220, 30, 30], 'red'], [[240, 140, 20], 'orange'], [[240, 220, 40], 'yellow'],
    [[40, 160, 60], 'green'], [[30, 100, 220], 'blue'], [[120, 50, 170], 'purple'],
    [[240, 150, 190], 'pink'], [[20, 30, 80], 'navy'], [[80, 110, 150], 'denim'],
    [[110, 70, 40], 'brown'], [[225, 205, 170], 'beige'],
  ];
  for (const [[r, g, b], name] of cases) assert.equal(nameColor(r, g, b), name, `${r},${g},${b}`);
});
test('detectColor ignores a plain background', () => {
  // 20×20 white image with a 10×10 red square in the middle
  assert.equal(detectColor(image(20, 20, [255, 255, 255], { x: 5, y: 5, size: 10, rgb: [220, 30, 30] }), 20, 20), 'red');
});
test('detectColor names a single-color image', () => {
  assert.equal(detectColor(image(10, 10, [128, 128, 128]), 10, 10), 'grey');
});
test('every color has a swatch', () => {
  for (const c of COLORS) assert.match(SWATCHES[c], /^#[0-9a-f]{6}$/i);
});
// image(w, h, bg, square?) is a small helper in this test file returning a Uint8ClampedArray of RGBA pixels (alpha 255).
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL, `Cannot find module` for `js/colors.js`.

- [ ] **Step 3: Write `js/settings.js` and implement `js/colors.js`**

`nameColor`: convert to HSL (h in degrees 0–360, s and l from 0 to 1), then the first matching row wins:

| # | Condition | Color |
|---|---|---|
| 1 | l < 0.15 | black |
| 2 | l > 0.90 | white |
| 3 | s < 0.15 | white if l > 0.80, else grey |
| 4 | 25 ≤ h ≤ 55 and s ≤ 0.55 and l ≥ 0.65 | beige |
| 5 | 10 ≤ h ≤ 45 and l < 0.45 | brown |
| 6 | 200 ≤ h ≤ 250 and l < 0.30 | navy |
| 7 | 195 ≤ h ≤ 230 and s ≤ 0.50 and 0.30 ≤ l ≤ 0.60 | denim |
| 8 | h ≥ 330 or h < 15 | pink if l > 0.65, else red |
| 9 | h < 40 | orange |
| 10 | h < 70 | yellow |
| 11 | h < 170 | green |
| 12 | h < 260 | blue |
| 13 | h < 290 | purple |
| 14 | otherwise (290–330) | pink if l > 0.55, else purple |

`detectColor`:
1. Background = average RGB of the border pixels (first and last row and column) with alpha ≥ 128.
2. Keep pixels with alpha ≥ 128 whose RGB distance (Euclidean) to the background is greater than 40.
3. If fewer than 5% of all pixels are kept, keep every pixel with alpha ≥ 128 instead.
4. Return the most common `nameColor` among kept pixels; a tie goes to the color that comes first in `COLORS`.

`detectImageColor`: `createImageBitmap(blob)`, draw it scaled to 48×48 on an `OffscreenCanvas` (or a `<canvas>` when that is missing), `getImageData`, then `detectColor`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests in `colors.test.js` plus Task 2's.

- [ ] **Step 5: Commit**

```bash
git add js/settings.js js/colors.js tests/colors.test.js
git commit -m "feat: add rule settings and color naming"
```

---

### Task 4: Building and filtering outfits

**Files:**
- Create: `js/rules.js`, `tests/helpers.js`
- Test: `tests/rules-build.test.js`

**Interfaces:**
- Consumes: `BOLDS`, `isNeutral` (Task 3); `outfitKey` (Task 2); `SETTINGS.maxBoldColors`.
- Produces `js/rules.js`:
  - `CATEGORIES = ['tops', 'dresses', 'pants', 'skirts', 'shoes', 'outerwear']` (order of pieces on a card)
  - `OCCASIONS = ['everyday', 'work', 'evening', 'special']`, `TEMPERATURES = ['cold', 'mild', 'hot']`
  - `STYLES = ['casual', 'smart', 'dressy']`, `WARMTHS = ['light', 'medium', 'warm']`
  - `ALLOWED_STYLES = { everyday: ['casual', 'smart'], work: ['smart'], evening: ['smart', 'dressy'], special: ['dressy'] }`
  - `fitsStyle(item: Item, occasion): boolean`
  - `fitsTemperature(item: Item, temperature): boolean`
  - `buildOutfits(items: Item[], { occasion, temperature }): { outfits: Outfit[], notes: NoteCode[] }` (`items` are fully labeled)
- Produces `tests/helpers.js`:
  - `makeItem(id, category, { color = 'black', warmth = 'medium', style = 'casual', lastWorn = null, wearCount = 0 } = {}): Item` (fileName `${id}.jpg`, addedAt `'2026-10-01'`)
  - `outfitOf(...items): Outfit`
  - `blankData(): Data` → `{ version: 1, items: {}, pairScores: {}, outfitPenalties: {}, settings: {} }`

Rules (spec §3.2–3.3):
- `fitsStyle`: tops, pants, skirts and dresses need a style in `ALLOWED_STYLES[occasion]`; shoes and outerwear need a style at most one step (in `STYLES` order) from the nearest allowed style.
- `fitsTemperature`: hot → warmth is not `warm`; cold → not (pants and `light`) and not (shoes and `light`); mild → always true.
- Outerwear that can be added: cold → `medium` or `warm`; mild → `light` or `medium`; hot → none. It must also pass `fitsStyle`.
- Shapes: each top × each pants-or-skirt × each shoe, and each dress × each shoe, using only pieces that pass `fitsStyle` and `fitsTemperature`.
- Cold: every outfit gets each fitting outerwear piece in turn; with no fitting outerwear, outfits stay without it and `notes` gets `'add-coat'`. Mild: each outfit alone, plus once with each fitting outerwear piece.
- Remove outfits with more than `SETTINGS.maxBoldColors` different bold colors.
- When no outfit remains: `'add-shoes'` if there are no shoes in `items`; `'add-main'` if `items` has no dress and lacks either a top or a pants-or-skirt; both may apply; if neither applies, `'no-match'`.

- [ ] **Step 1: Write `tests/helpers.js` and the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOutfits } from '../js/rules.js';
import { makeItem as m } from './helpers.js';

const keys = (r) => r.outfits.map((o) => o.key).sort();
const ctx = (occasion = 'everyday', temperature = 'mild') => ({ occasion, temperature });

test('builds the three outfit shapes', () => {
  const items = [m('t', 'tops'), m('p', 'pants'), m('k', 'skirts'), m('d', 'dresses'), m('s', 'shoes')];
  assert.deepEqual(keys(buildOutfits(items, ctx())), ['d|s', 'k|s|t', 'p|s|t']);
});
test('outfit pieces follow the card order', () => {
  const r = buildOutfits([m('s', 'shoes'), m('p', 'pants'), m('t', 'tops')], ctx());
  assert.deepEqual(r.outfits[0].items.map((i) => i.category), ['tops', 'pants', 'shoes']);
});
test('work never includes a casual top', () => {
  const items = [m('tc', 'tops', { style: 'casual' }), m('ts', 'tops', { style: 'smart' }),
    m('p', 'pants', { style: 'smart' }), m('s', 'shoes', { style: 'smart' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('work'))), ['p|s|ts']);
});
test('shoes may be one step off the occasion, main pieces may not', () => {
  const items = [m('d', 'dresses', { style: 'dressy' }), m('ds', 'dresses', { style: 'smart' }),
    m('s1', 'shoes', { style: 'smart' }), m('s2', 'shoes', { style: 'casual' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('special'))), ['d|s1']);
});
test('hot removes warm pieces and adds no outerwear', () => {
  const items = [m('t', 'tops', { warmth: 'warm' }), m('t2', 'tops', { warmth: 'light' }), m('p', 'pants'),
    m('s', 'shoes'), m('o', 'outerwear', { warmth: 'light' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('everyday', 'hot'))), ['p|s|t2']);
});
test('cold removes light pants and light shoes but keeps light skirts, dresses and tops', () => {
  const items = [m('t', 'tops', { warmth: 'light' }), m('p', 'pants', { warmth: 'light' }),
    m('k', 'skirts', { warmth: 'light' }), m('d', 'dresses', { warmth: 'light' }),
    m('s', 'shoes', { warmth: 'light' }), m('b', 'shoes', { warmth: 'warm' }), m('o', 'outerwear', { warmth: 'warm' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('everyday', 'cold'))), ['b|d|o', 'b|k|o|t']);
});
test('cold adds medium or warm outerwear to every outfit', () => {
  const items = [m('d', 'dresses'), m('s', 'shoes'), m('ol', 'outerwear', { warmth: 'light' }),
    m('om', 'outerwear', { warmth: 'medium' }), m('ow', 'outerwear', { warmth: 'warm' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('everyday', 'cold'))), ['d|om|s', 'd|ow|s']);
});
test('cold without fitting outerwear shows outfits without it and notes add-coat', () => {
  const r = buildOutfits([m('d', 'dresses'), m('s', 'shoes')], ctx('everyday', 'cold'));
  assert.deepEqual(keys(r), ['d|s']);
  assert.deepEqual(r.notes, ['add-coat']);
});
test('mild builds each outfit with and without light or medium outerwear', () => {
  const items = [m('d', 'dresses'), m('s', 'shoes'), m('ol', 'outerwear', { warmth: 'light' }),
    m('om', 'outerwear', { warmth: 'medium' }), m('ow', 'outerwear', { warmth: 'warm' })];
  assert.deepEqual(keys(buildOutfits(items, ctx())), ['d|ol|s', 'd|om|s', 'd|s']);
});
test('removes outfits with more than two bold colors', () => {
  const items = [m('t', 'tops', { color: 'red' }), m('p', 'pants', { color: 'green' }),
    m('s1', 'shoes', { color: 'blue' }), m('s2', 'shoes', { color: 'black' })];
  assert.deepEqual(keys(buildOutfits(items, ctx())), ['p|s2|t']);
});
test('explains why nothing is possible', () => {
  assert.deepEqual(buildOutfits([], ctx()).notes.sort(), ['add-main', 'add-shoes']);
  assert.deepEqual(buildOutfits([m('s', 'shoes')], ctx()).notes, ['add-main']);
  assert.deepEqual(buildOutfits([m('d', 'dresses'), m('s', 'shoes')], ctx('work')).notes, ['no-match']);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL, `Cannot find module` for `js/rules.js`.

- [ ] **Step 3: Implement the Interfaces block's `js/rules.js` exports**

Filter pieces one by one first, then combine them, so Task 5's large-wardrobe test stays fast.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add js/rules.js tests/helpers.js tests/rules-build.test.js
git commit -m "feat: build and filter outfits by occasion, temperature and color"
```

---

### Task 5: Scoring and picking outfits

**Files:**
- Modify: `js/rules.js`
- Test: `tests/rules-pick.test.js`

**Interfaces:**
- Consumes: `buildOutfits` (Task 4); `pairColorPoints`, `COLORS` (Task 3); `pairKeys` (Task 2); `daysBetween` (Task 2); `SETTINGS`; test helpers `makeItem`, `outfitOf`, `blankData` (Task 4).
- Produces in `js/rules.js`:
  - `isForgotten(item: Item, today: string): boolean`: `lastWorn` is null or at least `SETTINGS.forgottenDays` before `today`
  - `scoreOutfit(outfit: Outfit, data: Data, { today, somethingDifferent, rng }): number`
  - `pickOutfits(items: Item[], data: Data, { occasion, temperature, somethingDifferent = false, today, rng = Math.random, exclude = [], avoidItemIds = [], count = SETTINGS.suggestions }): { outfits: Outfit[], notes: NoteCode[] }`

`scoreOutfit` (spec §3.4) is the sum of:
- for each pair key of the outfit's ids: `pairColorPoints` of the two colors + `(data.pairScores[key] ?? 0)`
- `data.outfitPenalties[outfit.key] ?? 0`
- for each piece: `SETTINGS.recentPenalty` when `lastWorn` is set and `daysBetween(lastWorn, today) < SETTINGS.recentDays`; plus `SETTINGS.forgottenBonus` when `somethingDifferent` and `isForgotten`
- `rng() * SETTINGS.randomMax`

`pickOutfits`:
1. `buildOutfits` → outfits and notes.
2. With `somethingDifferent`: keep outfits containing at least one forgotten piece; if none would remain, keep them all and add `'all-recent'` to notes.
3. Drop outfits containing any id in `avoidItemIds`.
4. Score each outfit once, then sort by score, highest first.
5. Walk the list, skipping keys in `exclude` and outfits sharing a piece with one already picked, until `count` are picked.
6. If fewer than `count` were picked, walk again allowing keys in `exclude` (still no shared pieces, no outfit twice).

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreOutfit, pickOutfits } from '../js/rules.js';
import { COLORS } from '../js/colors.js';
import { makeItem as m, outfitOf, blankData } from './helpers.js';

const today = '2026-10-25';
const zero = () => 0;
const base = (opts = {}) => outfitOf(m('t', 'tops', { color: 'red', ...opts }), m('p', 'pants', { color: 'green', ...opts }), m('s', 'shoes', { color: 'black', ...opts }));
const score = (o, data = blankData(), extra = {}) => scoreOutfit(o, data, { today, somethingDifferent: false, rng: zero, ...extra });
const pick = (items, extra = {}) => pickOutfits(items, blankData(), { occasion: 'everyday', temperature: 'mild', today, rng: zero, ...extra });

test('color score adds up every pair', () => {
  assert.equal(score(base()), 5); // red–green +1, red–black +2, green–black +2
});
test('taste adds pair scores and the outfit penalty', () => {
  const data = blankData();
  data.pairScores['p|t'] = 2;
  data.outfitPenalties['p|s|t'] = -5;
  assert.equal(score(base(), data), 2);
});
test('a piece worn in the last 3 days loses 3 points', () => {
  assert.equal(score(outfitOf(m('t', 'tops', { color: 'red', lastWorn: '2026-10-23' }), m('p', 'pants', { color: 'green' }), m('s', 'shoes', { color: 'black' }))), 2);
  assert.equal(score(outfitOf(m('t', 'tops', { color: 'red', lastWorn: '2026-10-22' }), m('p', 'pants', { color: 'green' }), m('s', 'shoes', { color: 'black' }))), 5);
});
test('something different adds 4 per forgotten piece', () => {
  assert.equal(score(base(), blankData(), { somethingDifferent: true }), 17);
  assert.equal(score(outfitOf(m('t', 'tops', { color: 'red', lastWorn: '2026-10-15' }), m('p', 'pants', { color: 'green' }), m('s', 'shoes', { color: 'black' })), blankData(), { somethingDifferent: true }), 13);
});
test('randomness adds rng() × 1.5', () => {
  assert.equal(score(base(), blankData(), { rng: () => 0.5 }), 5.75);
});
test('picks 3 outfits that share no piece', () => {
  const items = ['a', 'b', 'c', 'd'].flatMap((x) => [m(`t${x}`, 'tops'), m(`p${x}`, 'pants'), m(`s${x}`, 'shoes')]);
  const ids = pick(items).outfits.flatMap((o) => o.items.map((i) => i.id));
  assert.equal(ids.length, 9);
  assert.equal(new Set(ids).size, 9);
});
test('something different puts a forgotten piece in every outfit', () => {
  const recent = { lastWorn: '2026-10-24' };
  const items = [m('t1', 'tops', recent), m('t2', 'tops'), m('p1', 'pants', recent), m('s1', 'shoes', recent), m('s2', 'shoes', recent)];
  for (const o of pick(items, { somethingDifferent: true }).outfits) assert.ok(o.items.some((i) => i.lastWorn === null));
});
test('notes all-recent when nothing is forgotten', () => {
  const recent = { lastWorn: '2026-10-24' };
  const r = pick([m('t', 'tops', recent), m('p', 'pants', recent), m('s', 'shoes', recent)], { somethingDifferent: true });
  assert.equal(r.outfits.length, 1);
  assert.deepEqual(r.notes, ['all-recent']);
});
test('exclude skips shown outfits, but shows them again when nothing else exists', () => {
  const items = [m('t1', 'tops'), m('t2', 'tops'), m('p', 'pants'), m('s', 'shoes')];
  assert.deepEqual(pick(items, { exclude: ['p|s|t1'], count: 1 }).outfits.map((o) => o.key), ['p|s|t2']);
  assert.equal(pick(items, { exclude: ['p|s|t1', 'p|s|t2'], count: 1 }).outfits.length, 1);
});
test('avoidItemIds keeps those pieces out', () => {
  const items = [m('t1', 'tops'), m('t2', 'tops'), m('p', 'pants'), m('s', 'shoes')];
  assert.deepEqual(pick(items, { avoidItemIds: ['t1'] }).outfits.map((o) => o.key), ['p|s|t2']);
});
test('returns fewer than 3 outfits when that is all there is', () => {
  assert.equal(pick([m('t', 'tops'), m('p', 'pants'), m('s', 'shoes')]).outfits.length, 1);
});
test('a 90-piece wardrobe picks in under 500 ms', () => {
  const spec = { tops: 30, pants: 15, skirts: 10, dresses: 10, shoes: 15, outerwear: 10 };
  let n = 0;
  const items = Object.entries(spec).flatMap(([cat, count]) => Array.from({ length: count }, () => {
    n += 1;
    return m(`i${n}`, cat, { color: COLORS[n % COLORS.length], warmth: cat === 'outerwear' ? 'light' : 'medium' });
  }));
  const start = performance.now();
  const r = pick(items);
  assert.ok(performance.now() - start < 500, `took ${performance.now() - start} ms`);
  assert.equal(r.outfits.length, 3);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL, `scoreOutfit` and `pickOutfits` are not exported.

- [ ] **Step 3: Implement `isForgotten`, `scoreOutfit` and `pickOutfits` in `js/rules.js`**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests, including the 500 ms one.

- [ ] **Step 5: Commit**

```bash
git add js/rules.js tests/rules-pick.test.js
git commit -m "feat: score outfits by color, taste and freshness and pick three"
```

---

### Task 6: Feedback

**Files:**
- Create: `js/feedback.js`
- Test: `tests/feedback.test.js`

**Interfaces:**
- Consumes: `pairKeys`, `outfitKey` (Task 2); `SETTINGS.taste`.
- Produces `js/feedback.js`, all changing `data` in place:
  - `like(data: Data, outfit: Outfit): void`: each pair `+SETTINGS.taste.like`
  - `dislike(data: Data, outfit: Outfit): void`: each pair `+SETTINGS.taste.dislike`; `data.outfitPenalties[outfit.key] += SETTINGS.taste.dislikeOutfit` (adds up across repeated 👎)
  - `woreThis(data: Data, outfit: Outfit, today: string): void`: for each piece, `data.items[id].lastWorn = today` and `wearCount += 1`; each pair `+SETTINGS.taste.wore`

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { like, dislike, woreThis } from '../js/feedback.js';
import { makeItem as m, outfitOf, blankData } from './helpers.js';

const setup = () => {
  const items = [m('t', 'tops'), m('p', 'pants'), m('s', 'shoes')];
  const data = blankData();
  for (const { id, ...rest } of items) data.items[id] = rest;
  return { data, outfit: outfitOf(...items) };
};

test('like adds 1 to each pair', () => {
  const { data, outfit } = setup();
  like(data, outfit);
  assert.deepEqual(data.pairScores, { 'p|t': 1, 's|t': 1, 'p|s': 1 });
});
test('dislike lowers the pairs and penalizes the exact outfit, adding up', () => {
  const { data, outfit } = setup();
  dislike(data, outfit);
  dislike(data, outfit);
  assert.equal(data.pairScores['p|t'], -2);
  assert.equal(data.outfitPenalties['p|s|t'], -10);
});
test('wore this records the date, counts the wear and adds 0.5 per pair', () => {
  const { data, outfit } = setup();
  data.pairScores['p|t'] = 1;
  woreThis(data, outfit, '2026-10-25');
  assert.equal(data.items.t.lastWorn, '2026-10-25');
  assert.equal(data.items.t.wearCount, 1);
  assert.equal(data.pairScores['p|t'], 1.5);
  assert.equal(data.pairScores['p|s'], 0.5);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL, `Cannot find module` for `js/feedback.js`.

- [ ] **Step 3: Implement `js/feedback.js`**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/feedback.js tests/feedback.test.js
git commit -m "feat: record likes, dislikes and worn outfits"
```

---

### Task 7: Store

**Files:**
- Create: `js/store.js`
- Test: `tests/store.test.js`

**Interfaces:**
- Consumes: `COLORS` (Task 3); `CATEGORIES`, `OCCASIONS`, `TEMPERATURES`, `STYLES`, `WARMTHS` (Task 4); `SETTINGS.saveDelayMs`.
- Produces `js/store.js`:
  - `emptyData(): Data` → `{ version: 1, items: {}, pairScores: {}, outfitPenalties: {}, settings: { occasion: 'everyday', temperature: 'mild', somethingDifferent: false } }`
  - `parseData(text: string | null): Data`
  - `mergeListing(data: Data, listing: ListingEntry[], today: string): { newIds: string[], changed: boolean }` (changes `data` in place)
  - `labeledItems(data: Data): Item[]`: pieces whose color, warmth and style are all set, with `id` added
  - `allItems(data: Data): Item[]`: every piece with `id` added
  - `unlabeledIds(data: Data): string[]`: pieces missing color, warmth or style, sorted by `addedAt`, then `fileName`
  - `createSaver(write: (text: string) => Promise<void>, { delayMs = SETTINGS.saveDelayMs, onStatus = () => {} } = {}): { schedule(data: Data): void, flush(): Promise<void> }`, where `onStatus` receives `'saving' | 'saved' | 'error'`

`parseData`: `null`, invalid JSON, a non-object, an array or `version !== 1` → `emptyData()`. Otherwise repair field by field:
- An item whose category is not in `CATEGORIES` is dropped.
- `color` not in `COLORS`, `warmth` not in `WARMTHS`, `style` not in `STYLES` → `null`.
- `fileName` that isn't a string → `''`.
- `lastWorn` not matching `/^\d{4}-\d{2}-\d{2}$/` → `null`; an invalid `addedAt` → `'2000-01-01'`.
- `wearCount` that isn't a non-negative integer → `0`.
- `pairScores` and `outfitPenalties` keep only finite numbers.
- Each setting outside its allowed values (`OCCASIONS`, `TEMPERATURES`, boolean) → its default.

`mergeListing`:
- A listed id not in `data.items` → new piece `{ category, fileName, color: null, warmth: null, style: null, addedAt: today, lastWorn: null, wearCount: 0 }`, and its id goes in `newIds`.
- A known id whose category or fileName changed → update those two fields only.
- A known id not in the listing → delete it, plus every `pairScores` and `outfitPenalties` key containing it (split each key on `|`).
- `changed` is true when anything was added, updated or removed.

`createSaver`:
- `schedule(data)` remembers the latest data and restarts the delay timer.
- When the timer fires: `onStatus('saving')`, then `write(JSON.stringify(data))`, then `onStatus('saved')` or `onStatus('error')`. If a write is still running, wait for it, then write the latest data.
- After an error the data stays unsaved; the next `schedule` or `flush` tries again.
- `flush()` cancels the timer and writes right away if anything is unsaved.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, parseData, mergeListing, labeledItems, unlabeledIds, createSaver } from '../js/store.js';

const entry = (id, category = 'tops', fileName = `${id}.jpg`) => ({ id, category, fileName, thumbUrl: null });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('parseData falls back to empty data', () => {
  for (const text of [null, 'not json', '[]', JSON.stringify({ version: 2, items: {} })]) {
    assert.deepEqual(parseData(text), emptyData());
  }
});
test('parseData repairs bad fields instead of crashing', () => {
  const data = parseData(JSON.stringify({
    version: 1,
    items: {
      a: { category: 'tops', fileName: 'a.jpg', color: 'teal', warmth: 'hot', style: 'casual', addedAt: '2026-10-01', lastWorn: 'yesterday', wearCount: 'x' },
      b: { category: 'hats', fileName: 'b.jpg' },
    },
    pairScores: { 'a|b': 'lots', 'a|c': 2 },
    settings: { occasion: 'party', temperature: 'cold' },
  }));
  assert.deepEqual(data.items.a, { category: 'tops', fileName: 'a.jpg', color: null, warmth: null, style: 'casual', addedAt: '2026-10-01', lastWorn: null, wearCount: 0 });
  assert.equal(data.items.b, undefined);
  assert.deepEqual(data.pairScores, { 'a|c': 2 });
  assert.deepEqual(data.outfitPenalties, {});
  assert.deepEqual(data.settings, { occasion: 'everyday', temperature: 'cold', somethingDifferent: false });
  assert.deepEqual(unlabeledIds(data), ['a']);
});
test('mergeListing adds new photos as unlabeled pieces', () => {
  const data = emptyData();
  assert.deepEqual(mergeListing(data, [entry('a')], '2026-10-25'), { newIds: ['a'], changed: true });
  assert.deepEqual(data.items.a, { category: 'tops', fileName: 'a.jpg', color: null, warmth: null, style: null, addedAt: '2026-10-25', lastWorn: null, wearCount: 0 });
});
test('mergeListing updates a moved photo and keeps its labels', () => {
  const data = emptyData();
  mergeListing(data, [entry('a')], '2026-10-01');
  Object.assign(data.items.a, { color: 'red', warmth: 'light', style: 'casual' });
  mergeListing(data, [entry('a', 'outerwear')], '2026-10-25');
  assert.equal(data.items.a.category, 'outerwear');
  assert.equal(data.items.a.style, 'casual');
});
test('mergeListing removes deleted photos with their scores and penalties', () => {
  const data = emptyData();
  mergeListing(data, [entry('a'), entry('b', 'pants'), entry('c', 'shoes')], '2026-10-01');
  data.pairScores = { 'a|b': 1, 'a|c': 1 };
  data.outfitPenalties = { 'a|b|c': -5 };
  mergeListing(data, [entry('a'), entry('c', 'shoes')], '2026-10-25');
  assert.equal(data.items.b, undefined);
  assert.deepEqual(data.pairScores, { 'a|c': 1 });
  assert.deepEqual(data.outfitPenalties, {});
});
test('mergeListing reports no change when nothing changed', () => {
  const data = emptyData();
  mergeListing(data, [entry('a')], '2026-10-01');
  assert.deepEqual(mergeListing(data, [entry('a')], '2026-10-25'), { newIds: [], changed: false });
});
test('labeledItems returns fully labeled pieces with their id', () => {
  const data = emptyData();
  mergeListing(data, [entry('a'), entry('b')], '2026-10-01');
  Object.assign(data.items.a, { color: 'red', warmth: 'light', style: 'casual' });
  assert.deepEqual(labeledItems(data).map((i) => i.id), ['a']);
  assert.deepEqual(unlabeledIds(data), ['b']);
});
test('the saver groups quick changes into one write', async () => {
  const writes = [];
  const saver = createSaver(async (t) => { writes.push(t); }, { delayMs: 10 });
  saver.schedule({ n: 1 });
  saver.schedule({ n: 2 });
  await wait(40);
  assert.deepEqual(writes, ['{"n":2}']);
});
test('the saver retries after a failed write', async () => {
  const statuses = [];
  let fail = true;
  const saver = createSaver(async () => { if (fail) throw new Error('offline'); }, { delayMs: 10, onStatus: (s) => statuses.push(s) });
  saver.schedule({ n: 1 });
  await wait(40);
  fail = false;
  saver.schedule({ n: 2 });
  await wait(40);
  assert.deepEqual(statuses, ['saving', 'error', 'saving', 'saved']);
});
test('flush writes right away', async () => {
  const writes = [];
  const saver = createSaver(async (t) => { writes.push(t); }, { delayMs: 10000 });
  saver.schedule({ n: 1 });
  await saver.flush();
  assert.deepEqual(writes, ['{"n":1}']);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL, `Cannot find module` for `js/store.js`.

- [ ] **Step 3: Implement `js/store.js`**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/store.js tests/store.test.js
git commit -m "feat: add data repair, OneDrive listing merge and debounced saving"
```

---

### Task 8: Sample wardrobe and sample source

**Files:**
- Create: `js/sample.js`, `js/sources.js`
- Test: `tests/sample.test.js`

**Interfaces:**
- Consumes: `SWATCHES`, `BOLDS` (Task 3); `pickOutfits`, `OCCASIONS`, `TEMPERATURES`, `CATEGORIES`, `STYLES`, `WARMTHS` (Tasks 4–5); `emptyData`, `parseData`, `labeledItems` (Task 7).
- Produces `js/sample.js`:
  - `SAMPLE_ITEMS: Item[]`: 22 to 30 fully labeled pieces, ids `sample-01`, `sample-02`, …, `fileName` a readable name such as `'Navy blazer'`
  - `sampleData(today: string): Data`: `emptyData()` plus `SAMPLE_ITEMS` keyed by id; about a third have `lastWorn` 1–2 days before `today`, a third 40 or more days before, a third never worn
  - `drawItem(category: Category, color: Color): string`: `'data:image/svg+xml,' + encodeURIComponent(svg)`, a simple silhouette per category in a 200×200 viewBox, filled with `SWATCHES[color]`, with a thin grey outline so white pieces show on white
- Produces `js/sources.js`: `createSampleSource({ storage, today }): Source` with `mode: 'sample'`:
  - `load()`: `parseData(storage.getItem('outfit-picker:sample'))` when that key exists, otherwise `sampleData(today)`; keeps a reference to the returned data; `newIds: []`
  - `refresh()`: resolves `{ newIds: [] }`
  - `photoUrl(id)`: `drawItem` of that piece's current category and color in the data loaded
  - `save(text)`: `storage.setItem('outfit-picker:sample', text)`

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_ITEMS, sampleData, drawItem } from '../js/sample.js';
import { createSampleSource } from '../js/sources.js';
import { pickOutfits, OCCASIONS, TEMPERATURES, CATEGORIES, STYLES, WARMTHS } from '../js/rules.js';
import { BOLDS, SWATCHES } from '../js/colors.js';
import { labeledItems } from '../js/store.js';

const today = '2026-10-25';
const fakeStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

test('sample pieces cover every type, style and warmth', () => {
  assert.ok(SAMPLE_ITEMS.length >= 22 && SAMPLE_ITEMS.length <= 30);
  assert.equal(new Set(SAMPLE_ITEMS.map((i) => i.id)).size, SAMPLE_ITEMS.length);
  for (const c of CATEGORIES) assert.ok(SAMPLE_ITEMS.some((i) => i.category === c), c);
  for (const s of STYLES) assert.ok(SAMPLE_ITEMS.some((i) => i.style === s), s);
  for (const w of WARMTHS) assert.ok(SAMPLE_ITEMS.some((i) => i.warmth === w), w);
  assert.ok(new Set(SAMPLE_ITEMS.map((i) => i.color).filter((c) => BOLDS.includes(c))).size >= 4);
  assert.equal(labeledItems(sampleData(today)).length, SAMPLE_ITEMS.length);
});
test('every occasion and temperature gets 3 sample outfits', () => {
  const data = sampleData(today);
  for (const occasion of OCCASIONS) for (const temperature of TEMPERATURES) {
    const r = pickOutfits(labeledItems(data), data, { occasion, temperature, today, rng: () => 0 });
    assert.equal(r.outfits.length, 3, `${occasion}/${temperature}`);
    assert.ok(!r.notes.includes('add-coat'), `${occasion}/${temperature}`);
  }
});
test('drawItem returns an SVG in the piece color', () => {
  const url = drawItem('tops', 'navy');
  assert.ok(url.startsWith('data:image/svg+xml,'));
  assert.ok(decodeURIComponent(url).toLowerCase().includes(SWATCHES.navy.toLowerCase()));
});
test('the sample source loads the sample first, then what was saved', async () => {
  const storage = fakeStorage();
  const first = await createSampleSource({ storage, today }).load();
  assert.equal(Object.keys(first.data.items).length, SAMPLE_ITEMS.length);
  first.data.settings.occasion = 'work';
  const source = createSampleSource({ storage, today });
  await source.save(JSON.stringify(first.data));
  assert.equal((await source.load()).data.settings.occasion, 'work');
  assert.ok(source.photoUrl('sample-01').startsWith('data:image/svg+xml,'));
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL, `Cannot find module` for `js/sample.js`.

- [ ] **Step 3: Implement `js/sample.js` and `createSampleSource` in `js/sources.js`**

Choose the sample pieces so the "3 outfits everywhere" test passes. Special event in Cold needs 3 separate dressy main outfits, 3 non-light Smart or Dressy shoes and 3 Medium or Warm outerwear pieces; in Hot it needs 3 non-warm ones.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/sample.js js/sources.js tests/sample.test.js
git commit -m "feat: add sample wardrobe and sample data source"
```

---

### Task 9: App shell and home screen (sample mode)

**Files:**
- Create: `index.html`, `css/app.css`, `js/app.js`, `js/ui/dom.js`, `js/ui/home.js`

**Interfaces:**
- Consumes: `createSampleSource` (Task 8); `labeledItems`, `unlabeledIds`, `createSaver` (Task 7); `pickOutfits`, `OCCASIONS`, `TEMPERATURES` (Tasks 4–5); `like`, `dislike`, `woreThis` (Task 6); `todayISO` (Task 2).
- Produces `js/ui/dom.js`:
  - `h(tag: string, attrs?: object, ...children): HTMLElement`: `class` sets className; `on<Event>` keys add listeners; `true` booleans set empty attributes and `false`/`null` skip; other keys use `setAttribute`; string children become text nodes; `null`/`false` children are skipped
  - `photo(url: string | null, fileName: string): HTMLElement`: an `<img alt=fileName>`; when `url` is null or the image fails to load, a placeholder box showing `fileName`
- Produces `js/ui/home.js`: `renderHome(root, view, actions)`
  - `view = { settings, cards: Array<{ outfit: Outfit, liked: boolean, worn: boolean }>, notes: NoteCode[], newCount: number, photoUrl: (id) => string | null, sampleMode: boolean, saveError: boolean, hasLabeled: boolean }`
  - `actions = { setOccasion(o), setTemperature(t), toggleDifferent(), shuffle(), like(i), dislike(i), wore(i), openLabel(), openWardrobe(), exitSample() }`
- Produces `js/app.js` (no exports; calls `start()` on load): owns `state` and `render()`. Screens in this task: `'signin'` and `'home'`. Tasks 10 and 12 add more.

Exact copy:
- Occasions: **Everyday**, **Work**, **Evening out**, **Special event**. Temperatures: **Cold**, **Mild**, **Hot**. Switch: **Something different**. Button: **Shuffle**. Link: **Wardrobe**.
- Card buttons: **👍** (highlighted and disabled once liked), **👎**, **Wore this** (becomes **Worn today ✓**, disabled).
- Banner when `newCount > 0`: `${n} new piece${n === 1 ? '' : 's'} to label` (opens labeling).
- Notes: `add-shoes` "Add some shoes"; `add-main` "Add at least one top and one pair of pants or skirt, or a dress"; `add-coat` "Add a coat to Outerwear"; `all-recent` "Everything has been worn recently"; `no-match` "No outfits match this occasion and temperature yet. Try another choice, or label more pieces."
- When `!hasLabeled`: "Welcome! Save photos of your clothes into the Wardrobe folder in your OneDrive: Tops, Pants, Skirts, Dresses, Shoes and Outerwear. Then come back here to label them."
- Sample banner: "Sample mode" with an **Exit** button. Save problem: "Not saved, retrying".
- Sign-in screen: title "Outfit Picker", **Sign in with Microsoft** (disabled in this task; Task 12 enables it), **Try with sample clothes**.

`js/app.js` behavior:
- `start()`: if `localStorage['outfit-picker:mode'] === 'sample'`, enter sample mode; otherwise show `'signin'`.
- Enter sample mode: set mode `'sample'` in localStorage; `source = createSampleSource({ storage: localStorage, today: todayISO() })`; `await source.load()`; `saver = createSaver((t) => source.save(t), { onStatus })`; show `'home'`; recompute cards.
- Recompute: `pickOutfits(labeledItems(data), data, { ...data.settings, today: todayISO() })` → `cards` (liked and worn false) and `notes`.
- `setOccasion`, `setTemperature`, `toggleDifferent`: update `data.settings`, schedule a save, recompute.
- `shuffle`: recompute with `exclude` = current card keys.
- `like(i)`: `like(data, outfit)`; mark the card liked; schedule a save.
- `dislike(i)`: `dislike(data, outfit)`; replace card `i` with `pickOutfits(..., { exclude: [its key, ...other card keys], avoidItemIds: other cards' piece ids, count: 1 }).outfits[0]`, or remove the card if there is none; schedule a save.
- `wore(i)`: `woreThis(data, outfit, todayISO())`; mark the card worn; schedule a save.
- `exitSample`: `await saver.flush()`, remove the mode key, show `'signin'`.
- Every action calls `render()`. `render()` clears `#app` and calls the current screen's render function.

- [ ] **Step 1: Write `js/ui/dom.js`, `js/ui/home.js` and `js/app.js`**

- [ ] **Step 2: Write `index.html` and `css/app.css`**

`index.html`: charset and viewport metas, `<title>Outfit Picker</title>`, the MSAL tag from Global Constraints, `<main id="app"></main>`, `<script type="module" src="js/app.js"></script>`. `css/app.css`: phone first; cards stacked; each card shows its photos in one row of up to 4 square tiles with `object-fit: contain` on a light background; occasion and temperature as chips; explicit `body` background and text colors.

- [ ] **Step 3: Run the automated tests**

Run: `npm test`
Expected: PASS, all earlier tests (no pure module changed).

- [ ] **Step 4: Check it in the browser pane**

Run `preview_start` with `outfit-picker`, set the viewport to mobile (375×812), open `http://localhost:8080/`. Expected:
- The sign-in screen shows **Try with sample clothes**.
- Tapping it shows the "Sample mode" banner, the choices, and 3 cards of drawings with no piece on two cards.
- Choosing **Special event** changes the cards; choosing **Cold** adds an outerwear drawing to every card.
- **👎** replaces that card; **👍** highlights; **Wore this** becomes **Worn today ✓**.
- Reloading goes straight back to sample mode with the same choices selected.
- `read_console_messages` with `onlyErrors` shows nothing.
- At 320×700 there is no horizontal scrolling.

- [ ] **Step 5: Commit**

```bash
git add index.html css/app.css js/app.js js/ui/dom.js js/ui/home.js
git commit -m "feat: add app shell and home screen with sample mode"
```

---

### Task 10: Labeling and wardrobe screens

**Files:**
- Create: `js/ui/label.js`, `js/ui/wardrobe.js`
- Modify: `js/app.js`, `css/app.css`

**Interfaces:**
- Consumes: `h`, `photo` (Task 9); `allItems`, `unlabeledIds` (Task 7); `COLORS`, `SWATCHES` (Task 3); `STYLES`, `WARMTHS` (Task 4); `FOLDERS` (Task 1).
- Produces `js/ui/label.js`: `renderLabel(root, view, actions)`
  - `view = { item: Item, photoUrl: string | null, mode: 'new' | 'edit', remaining: number }`
  - `actions = { setColor(c), setWarmth(w), setStyle(s), skip(), done(), back() }`
- Produces `js/ui/wardrobe.js`: `renderWardrobe(root, view, actions)`
  - `view = { items: Item[], photoUrl: (id) => string | null, canRefresh: boolean }`
  - `actions = { edit(id), refresh(), back() }`

Exact copy:
- Label heading: `New piece (${remaining} left)` in new mode, "Edit piece" in edit mode. Rows: **Color** (swatch plus name; tapping opens a grid of all 14 colors with their names), **Warmth** (Light / Medium / Warm), **Style** (Casual / Smart / Dressy); the current values are highlighted. Buttons: **Skip** (new mode), **Done** (edit mode), **Back**.
- Wardrobe heading "Wardrobe"; one section per `FOLDERS` key in order (Tops, Pants, Skirts, Dresses, Shoes, Outerwear), with empty sections hidden. Each tile shows the photo, a color swatch, `Medium · Smart` and "Last worn Oct 20" or "Never worn". Unlabeled tiles say "Needs labels". Buttons: **Refresh** (only when `canRefresh`) and **Back**.

`js/app.js` additions:
- `openLabel()`: queue = `unlabeledIds(data)`; mode `'new'`; show the first piece.
- `setColor`, `setWarmth`, `setStyle`: set the field on `data.items[id]` and schedule a save. In new mode, once color, warmth and style are all set, move to the next piece in the queue.
- `skip()`: move to the next piece (the skipped one stays unlabeled).
- When the queue runs out, or on **Back**: go home and recompute cards.
- From the wardrobe, `edit(id)` opens the label screen in edit mode; **Done** returns to the wardrobe. **Back** from the wardrobe goes home and recomputes.
- Home `newCount` = `unlabeledIds(data).length`. In sample mode `canRefresh` is false.

- [ ] **Step 1: Write `js/ui/label.js` and `js/ui/wardrobe.js`; wire them into `js/app.js`; add their styles**

- [ ] **Step 2: Run the automated tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Check it in the browser pane**

In sample mode at 375×812:
- **Wardrobe** lists six sections with drawings and labels; tapping a piece opens "Edit piece" with its values highlighted; changing Style and tapping **Done** shows the new style on its tile.
- Set up unlabeled pieces for testing: with `javascript_tool`, set `warmth` to `null` on two pieces in `localStorage['outfit-picker:sample']`, then reload. Home shows "2 new pieces to label". Labeling both returns home with no banner; **Skip** leaves a piece unlabeled and the banner says "1 new piece to label".
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add js/ui/label.js js/ui/wardrobe.js js/app.js css/app.css
git commit -m "feat: add labeling and wardrobe screens"
```

---

### Task 11: Microsoft Graph client

**Files:**
- Create: `js/onedrive.js`
- Test: `tests/onedrive.test.js`

**Interfaces:**
- Consumes: `WARDROBE_FOLDER`, `FOLDERS`, `DATA_FILE` (Task 1); `IMAGE_STRATEGY` from `docs/superpowers/probe-results.md`.
- Produces `js/onedrive.js`:
  - `class GraphError extends Error` with `status: number` (0 means a network failure) and the response text as `message`
  - `createGraph({ getToken: () => Promise<string>, fetchFn = (...args) => fetch(...args), imageStrategy = '<IMAGE_STRATEGY from probe-results.md>' }): Graph`
  - `Graph = { ensureFolders(): Promise<void>, listWardrobe(): Promise<ListingEntry[]>, fetchImageBlob(entry: ListingEntry): Promise<Blob>, readData(): Promise<string | null>, writeData(text: string): Promise<void> }`

Requests: base `https://graph.microsoft.com/v1.0`. Every Graph request sends `Authorization: Bearer <token>`.

| Method | Path | Notes |
|---|---|---|
| GET | `/me/drive/root:/Wardrobe:/children?$select=name,folder&$top=200` | 404 means `Wardrobe` is missing |
| POST | `/me/drive/root/children` | body `{ "name": "Wardrobe", "folder": {}, "@microsoft.graph.conflictBehavior": "fail" }`; 409 counts as success |
| POST | `/me/drive/root:/Wardrobe:/children` | same body shape, once per missing subfolder |
| GET | `/me/drive/root:/Wardrobe/<Folder>:/children?$expand=thumbnails&$select=id,name,file&$top=200` | follow `@odata.nextLink` (an absolute URL, requested as given) until absent; keep entries whose `file.mimeType` starts with `image/`; `thumbUrl` = `thumbnails[0].medium.url`, or null |
| GET | `/me/drive/special/approot:/data.json:/content` | 404 → `null` |
| PUT | `/me/drive/special/approot:/data.json:/content` | `Content-Type: application/json` |
| GET | `/me/drive/items/<id>?$select=id,@microsoft.graph.downloadUrl` | only for `imageStrategy: 'download'`; then fetch that URL without Authorization |

With `imageStrategy: 'thumbnail'`, `fetchImageBlob` fetches `entry.thumbUrl` without Authorization. Any other non-2xx response → `GraphError(status, text)`; a rejected fetch → `GraphError(0, message)`.

- [ ] **Step 1: Write the failing tests**

Use a fake `fetchFn` that records `{ method, url, headers, body }` and answers from a route table with `new Response(...)`.

```js
test('ensureFolders creates Wardrobe and all six subfolders when Wardrobe is missing', async () => {
  // GET Wardrobe children → 404; every POST → 201
  await graph.ensureFolders();
  assert.deepEqual(posts.map((p) => JSON.parse(p.body).name), ['Wardrobe', 'Tops', 'Pants', 'Skirts', 'Dresses', 'Shoes', 'Outerwear']);
});
test('ensureFolders only creates missing subfolders', async () => {
  // GET Wardrobe children → { value: [{ name: 'Tops', folder: {} }, { name: 'Shoes', folder: {} }] }
  assert.deepEqual(postedNames, ['Pants', 'Skirts', 'Dresses', 'Outerwear']);
});
test('ensureFolders treats 409 as already created', async () => {
  // GET → 404; POSTs → 409
  await assert.doesNotReject(graph.ensureFolders());
});
test('listWardrobe follows paging and keeps only images', async () => {
  // Tops page 1: 2 images + "@odata.nextLink": "https://graph.microsoft.com/v1.0/next-page-token"
  // that URL: 1 image, 1 video/mp4, 1 application/pdf; the other five folders: { value: [] }
  const list = await graph.listWardrobe();
  assert.equal(list.length, 3);
  assert.ok(list.every((e) => e.category === 'tops' && e.thumbUrl));
  assert.ok(requests.some((r) => r.url === 'https://graph.microsoft.com/v1.0/next-page-token'));
});
test('readData returns null when there is no data file', async () => { /* GET → 404 */ assert.equal(await graph.readData(), null); });
test('writeData saves data.json in the app folder as JSON', async () => {
  await graph.writeData('{"version":1}');
  assert.equal(last.method, 'PUT');
  assert.equal(last.url, 'https://graph.microsoft.com/v1.0/me/drive/special/approot:/data.json:/content');
  assert.equal(last.headers['Content-Type'], 'application/json');
  assert.equal(last.body, '{"version":1}');
});
test('every Graph request sends the token', async () => {
  // after ensureFolders + listWardrobe + readData
  assert.ok(graphRequests.every((r) => r.headers.Authorization === 'Bearer test-token'));
});
test('errors carry the HTTP status, and network failures use status 0', async () => {
  // GET data.json → 500
  await assert.rejects(graph.readData(), (e) => e instanceof GraphError && e.status === 500);
  // fetchFn throws TypeError
  await assert.rejects(offlineGraph.readData(), (e) => e instanceof GraphError && e.status === 0);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL, `Cannot find module` for `js/onedrive.js`.

- [ ] **Step 3: Implement `js/onedrive.js`**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/onedrive.js tests/onedrive.test.js
git commit -m "feat: add Microsoft Graph client for wardrobe folders and data file"
```

---

### Task 12: Sign-in and OneDrive mode

**Files:**
- Create: `js/auth.js`
- Modify: `js/sources.js`, `js/app.js`
- Test: `tests/sources.test.js`

**Interfaces:**
- Consumes: `createGraph`, `GraphError` (Task 11); `parseData`, `mergeListing` (Task 7); `detectImageColor` (Task 3); `CLIENT_ID`, `CLIENT_ID_PLACEHOLDER`, `AUTHORITY`, `SCOPES`, `redirectUri` (Task 1); `IOS_HOME_SCREEN_SIGNIN` from `docs/superpowers/probe-results.md`.
- Produces `js/auth.js` (browser only, uses the global `msal`):
  - `isConfigured(): boolean`: `CLIENT_ID !== CLIENT_ID_PLACEHOLDER`
  - `initAuth(): Promise<object | null>`: `new msal.PublicClientApplication({ auth: { clientId: CLIENT_ID, authority: AUTHORITY, redirectUri: redirectUri() }, cache: { cacheLocation: 'localStorage' } })`, `await initialize()`, `await handleRedirectPromise()`; sets and returns the active account (from the redirect result, else the first cached account), or null
  - `signIn(): Promise<void>`: `loginRedirect({ scopes: SCOPES })`; when `IOS_HOME_SCREEN_SIGNIN` is `popup` and the page runs from the home screen (`navigator.standalone === true` or `matchMedia('(display-mode: standalone)').matches`), use `loginPopup` instead and resolve with the account set
  - `getToken(): Promise<string>`: `acquireTokenSilent({ scopes: SCOPES, account })`; on `msal.InteractionRequiredAuthError`, call `acquireTokenRedirect({ scopes: SCOPES })` and throw `new Error('redirecting')`
- Produces in `js/sources.js`: `createOneDriveSource({ graph, detect: (entry: ListingEntry) => Promise<Color>, storage, today }): Source` with `mode: 'onedrive'`:
  - `load()`: `await graph.ensureFolders()`; text = `storage.getItem('outfit-picker:pending')` if present, else `await graph.readData()`; `data = parseData(text)`; then the refresh steps below; saves when the merge changed anything or pending data was used; returns `{ data, newIds }`
  - `refresh(data)`: `listing = await graph.listWardrobe()`; remember each `thumbUrl` by id; `mergeListing(data, listing, today)`; for each new id, `data.items[id].color = await detect(entry)` (at most 4 at a time; a rejected `detect` leaves `null`); saves when changed; returns `{ newIds }`
  - `photoUrl(id)`: the `thumbUrl` from the latest listing, or null
  - `save(text)`: `storage.setItem('outfit-picker:pending', text)`, `await graph.writeData(text)`, then `storage.removeItem('outfit-picker:pending')`. If writing fails, the pending copy stays and the error is thrown.

`js/app.js` additions:
- `start()`: sample mode as before; otherwise, if `isConfigured()`, `await initAuth()`; with an account → enter OneDrive mode; otherwise the sign-in screen. **Sign in with Microsoft** is enabled when `isConfigured()`; when not configured it shows "Add your Microsoft app ID in js/config.js (see README)" instead.
- If the global `msal` is missing (the CDN script failed to load), show the offline error below instead of crashing.
- **Sign in with Microsoft** calls `signIn()`; when it resolves without leaving the page (popup case), enter OneDrive mode.
- Enter OneDrive mode: screen `'loading'` with "Loading your wardrobe…"; `graph = createGraph({ getToken })`; `detect = async (entry) => detectImageColor(await graph.fetchImageBlob(entry))`; `source = createOneDriveSource({ graph, detect, storage: localStorage, today: todayISO() })`; `await source.load()`; set mode `'onedrive'` in localStorage; show home.
- Wardrobe **Refresh** (`canRefresh` true in OneDrive mode): `await source.refresh(data)`, then re-render; recompute cards when returning home.
- Errors from load or refresh: `GraphError` with status 0, or `navigator.onLine === false` → screen `'error'` with "You're offline. Connect to load your wardrobe." and **Retry**; any other `GraphError` → "Couldn't reach OneDrive." and **Retry**; `Error('redirecting')` → do nothing. **Retry** re-runs the action that failed.
- Saver status `'error'` → `saveError: true` (home shows "Not saved, retrying"); `'saved'` → false.

- [ ] **Step 1: Write the failing tests**

Fake graph: records calls; `listWardrobe` returns a settable listing (default: `entry('a')` and `entry('b')`, where `entry(id)` returns `{ id, category: 'tops', fileName: `${id}.jpg`, thumbUrl: `https://thumbs.example/${id}` }`); `readData` returns a settable string; `writeData` can be told to reject. Fake storage as in Task 8.

```js
test('load creates folders, merges photos and detects colors of new pieces only', async () => {
  // readData → data with piece 'a' labeled; listing → entries 'a' and 'b'; detect → 'navy'
  const { data, newIds } = await source.load();
  assert.equal(graph.calls.ensureFolders, 1);
  assert.deepEqual(detected.map((e) => e.id), ['b']);
  assert.deepEqual(newIds, ['b']);
  assert.equal(data.items.b.color, 'navy');
  assert.equal(graph.writes.length, 1);
});
test('load uses unsaved changes left from last time', async () => {
  // storage 'outfit-picker:pending' holds data where piece 'a' has wearCount 5; readData must not be called
  const { data } = await source.load();
  assert.equal(data.items.a.wearCount, 5);
  assert.equal(graph.calls.readData, 0);
  assert.equal(storage.getItem('outfit-picker:pending'), null);
});
test('a failed color detection leaves the color empty', async () => {
  // detect rejects for 'b'
  const { data, newIds } = await source.load();
  assert.deepEqual(newIds, ['b']);
  assert.equal(data.items.b.color, null);
});
test('save keeps the change in the browser until OneDrive confirms it', async () => {
  graph.failWrites = true;
  await assert.rejects(source.save('{"version":1}'));
  assert.equal(storage.getItem('outfit-picker:pending'), '{"version":1}');
  graph.failWrites = false;
  await source.save('{"version":1}');
  assert.equal(storage.getItem('outfit-picker:pending'), null);
});
test('photoUrl returns the thumbnail from the latest listing', async () => {
  await source.load();
  assert.equal(source.photoUrl('a'), 'https://thumbs.example/a');
});
test('refresh drops deleted photos', async () => {
  const { data } = await source.load();
  graph.listing = [entry('b')];
  await source.refresh(data);
  assert.equal(data.items.a, undefined);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL, `createOneDriveSource` is not exported.

- [ ] **Step 3: Implement `createOneDriveSource` in `js/sources.js`**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write `js/auth.js` and the `js/app.js` additions**

- [ ] **Step 6: Run the automated tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Check sign-in with the builder's account**

The builder signs in; the agent never types the password. With `CLIENT_ID` filled in, open `http://localhost:8080/` and tap **Sign in with Microsoft**. Expected:
- After sign-in, "Loading your wardrobe…", then home.
- In OneDrive: `Wardrobe` with all six subfolders exists.
- After adding 3 photos to `Wardrobe/Tops`, `Pants` and `Shoes` and tapping **Refresh** on the Wardrobe screen: "3 new pieces to label"; each shows a detected color; labeling all three gives an outfit card with real photos.
- After **Wore this**, `Apps/Outfit Picker/data.json` exists in OneDrive and contains today's date on those pieces.
- Reloading keeps the labels and stays signed in.
- With the network turned off (browser offline mode), reloading shows "You're offline. Connect to load your wardrobe." and **Retry** works once back online.

- [ ] **Step 8: Commit**

```bash
git add js/auth.js js/sources.js js/app.js tests/sources.test.js
git commit -m "feat: sign in with Microsoft and load the wardrobe from OneDrive"
```

---

### Task 13: Installable app, hand-off guide and final check

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `scripts/make-icons.mjs`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png`
- Modify: `index.html`, `js/app.js`, `README.md`
- Test: `tests/icons.test.js`

**Interfaces:**
- Consumes: every app file from Tasks 1–12 (for the service worker's file list).
- Produces:
  - `manifest.webmanifest`: `name` "Outfit Picker", `short_name` "Outfits", `start_url` "./", `scope` "./", `display` "standalone", `background_color` and `theme_color` matching `css/app.css`, icons 192 and 512 (PNG).
  - `index.html` head additions: `<link rel="manifest" href="manifest.webmanifest">`, `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`, `<meta name="theme-color">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-title" content="Outfits">`.
  - `sw.js`: `CACHE_NAME = 'outfit-picker-v1'`; `APP_FILES` = `./`, `index.html`, `css/app.css`, every file under `js/`, `manifest.webmanifest`, the three icons and the MSAL CDN URL. Install → `cache.addAll(APP_FILES)`; activate → delete every other cache; fetch → for GET requests whose URL is in `APP_FILES`, cache first with network fallback; every other request (Graph, thumbnails, sign-in) is left to the network (no `respondWith`).
  - `js/app.js` registers `sw.js` only when `location.protocol === 'https:'`.
  - `scripts/make-icons.mjs`: writes the three PNGs (192, 512 and 180 pixels square) using only `node:zlib` and `node:fs` (with its own CRC32): a rounded square in the theme color with a white T-shirt silhouette built from rectangles.

- [ ] **Step 1: Write the failing icon test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const [file, size] of [['icons/icon-192.png', 192], ['icons/icon-512.png', 512], ['icons/apple-touch-icon.png', 180]]) {
  test(`${file} is a ${size}px PNG`, () => {
    const png = readFileSync(file);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), size); // IHDR width
    assert.equal(png.readUInt32BE(20), size); // IHDR height
  });
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL, `ENOENT` for the icon files.

- [ ] **Step 3: Write and run `scripts/make-icons.mjs`**

Run: `node scripts/make-icons.mjs`
Expected: the three PNG files exist; open one with the Read tool to check that it looks right.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, every test in the project.

- [ ] **Step 5: Write `manifest.webmanifest` and `sw.js`, add the `index.html` head tags and service worker registration**

- [ ] **Step 6: Finish `README.md`**

Sections:
- **Test it yourself:** `npm test`, sample mode, your own account.
- **Put it online:** push to GitHub; Pages updates on its own; raise `CACHE_NAME` in `sw.js` (`-v2`, `-v3`, …) with every update so phones get the new version.
- **Give it to your friend:** send the link; she signs in with her own account; then **Add to Home Screen** (or a Safari bookmark if `IOS_HOME_SCREEN_SIGNIN` is `safari-only`); tell her the six folder names and "one piece per photo, plain background".
- **Adjust the rules:** what each value in `js/settings.js` changes.
- **Start over:** delete `Apps/Outfit Picker/data.json` in OneDrive.
- **Troubleshooting:** sign-in errors → check the redirect URIs match exactly, including the trailing `/`; new photos not showing → **Refresh** on the Wardrobe screen.

- [ ] **Step 7: Final check (spec §6)**

- `npm test` → every test passes.
- Browser pane at 375×812: the full sample-mode walk-through from Tasks 9 and 10 with no console errors.
- The builder pushes to GitHub Pages, opens the link on the phone, signs in, adds it to the home screen, opens it from the icon, labels 3 photos, sees outfits, taps **Wore this**, closes and reopens the app, and finds everything kept.

- [ ] **Step 8: Commit**

```bash
git add manifest.webmanifest sw.js scripts/make-icons.mjs icons index.html js/app.js README.md tests/icons.test.js
git commit -m "feat: make the app installable and finish the setup guide"
```
