import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTROS, INTRO_MAX_MS, introFor, pickIntro } from '../js/ui/intro.js';

// The name on the opening screen (big, on the left, halfway down) and on the home screen.
const opening = { left: 16, top: 380, fontSize: 36 };
const home = { left: 16, top: 16, fontSize: 22 };
const size = { width: 180, height: 32 };

// Where a CSS transform puts point (px, py) of the name, measured from its top-left corner.
function apply(transform, px, py) {
  const steps = [...transform.matchAll(/(translate|scale|rotate)\(([^)]*)\)/g)]
    .map(([, fn, args]) => [fn, args.split(',').map((a) => parseFloat(a))]);
  let [x, y] = [px, py];
  for (const [fn, a] of steps.reverse()) {
    if (fn === 'translate') [x, y] = [x + a[0], y + (a[1] ?? 0)];
    else if (fn === 'scale') [x, y] = [x * a[0], y * (a[1] ?? a[0])];
    else {
      const r = (a[0] * Math.PI) / 180;
      [x, y] = [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
    }
  }
  return [x, y];
}

const near = (actual, expected, label) => {
  for (let i = 0; i < 2; i++) assert.ok(Math.abs(actual[i] - expected[i]) < 0.05, `${label}: ${actual} vs ${expected}`);
};

test('there are 7 opening animations', () => {
  assert.deepEqual(INTROS, ['glide', 'bounce', 'loop', 'spin', 'swing', 'pop', 'jelly']);
});

test('every animation starts where the name was on the opening screen, at its size there', () => {
  const k = opening.fontSize / home.fontSize;
  const [dx, dy] = [opening.left - home.left, opening.top - home.top];
  for (const name of INTROS) {
    const first = introFor(name, opening, home, size).keyframes[0];
    near(apply(first.transform, 0, 0), [dx, dy], `${name} top-left`);
    near(apply(first.transform, size.width, size.height), [dx + k * size.width, dy + k * size.height], `${name} bottom-right`);
    assert.ok(first.opacity === undefined || first.opacity === 1, name);
  }
});

test('every animation ends with the name in its place at the top', () => {
  for (const name of INTROS) {
    const last = introFor(name, opening, home, size).keyframes.at(-1);
    near(apply(last.transform, 0, 0), [0, 0], `${name} top-left`);
    near(apply(last.transform, size.width, size.height), [size.width, size.height], `${name} bottom-right`);
    assert.ok(last.opacity === undefined || last.opacity === 1, name);
  }
});

test('every animation is short, with its steps in order', () => {
  for (const name of INTROS) {
    const { duration, keyframes } = introFor(name, opening, home, size);
    assert.ok(duration >= 500 && duration <= INTRO_MAX_MS, `${name}: ${duration} ms`);
    const offsets = keyframes.map((f) => f.offset).filter((o) => o !== undefined);
    assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b), name);
  }
});

// The numbers inside each step of a transform, e.g. every rotate(...) angle.
const values = (transform, fn) => [...transform.matchAll(new RegExp(`${fn}\\(([^)]*)\\)`, 'g'))]
  .map(([, args]) => args.split(',').map((a) => parseFloat(a)));
const allOf = (name, fn) => introFor(name, opening, home, size).keyframes.flatMap((f) => values(f.transform, fn));
const corner = (name) => introFor(name, opening, home, size).keyframes.map((f) => apply(f.transform, 0, 0));

test('the animations move a lot', () => {
  assert.ok(corner('glide').some(([x]) => x >= 60), 'glide swoops out to the right');
  assert.ok(corner('bounce').some(([, y]) => y >= 60), 'bounce drops far after hitting the top');
  assert.ok(Math.max(...allOf('loop', 'rotate').map(([a]) => Math.abs(a))) >= 360, 'loop turns the name all the way around');
  assert.ok(corner('loop').some(([x]) => x >= 100), 'loop is big');
  assert.equal(allOf('spin', 'rotate')[0][0], -720, 'spin turns twice');
  assert.ok(Math.max(...allOf('swing', 'rotate').map(([a]) => Math.abs(a))) >= 26, 'swing swings far');
  assert.ok(Math.max(...allOf('pop', 'scale').map(([k]) => k)) >= 1.4, 'pop pops big');
  assert.ok(Math.max(...allOf('jelly', 'scale').map(([sx]) => sx)) >= 1.45, 'jelly squishes hard');
});

// Every frame the browser draws between two keyframes: it blends each number of the steps
// (keyframes of one animation have the same steps), here at 20 points along the way.
const NUMBER = /-?\d+(?:\.\d+)?/g;
function frames(keyframes) {
  const out = [keyframes[0].transform];
  for (let i = 0; i + 1 < keyframes.length; i++) {
    const [a, b] = [keyframes[i].transform.match(NUMBER).map(Number), keyframes[i + 1].transform.match(NUMBER).map(Number)];
    for (let step = 1; step <= 20; step++) {
      let n = 0;
      out.push(keyframes[i].transform.replace(NUMBER, () => { const v = a[n] + (b[n] - a[n]) * (step / 20); n += 1; return String(v); }));
    }
  }
  return out;
}

test('every animation keeps the name on a small phone screen, the whole way', () => {
  // "lil evil wardrobe" at 22 px, 16 px from the top of a 375 px wide iPhone SE; the opening
  // name starts 104 px lower (sample mode, under its banner), 124 px (iPhone SE) or 176 px.
  const phone = { width: 375 };
  const real = { width: 207, height: 32 };
  for (const drop of [104, 124, 176]) {
    const from = { left: 16, top: 16 + drop, fontSize: 36 };
    for (const name of INTROS) {
      for (const transform of frames(introFor(name, from, home, real).keyframes)) {
        for (const [cx, cy] of [[0, 0], [real.width, 0], [0, real.height], [real.width, real.height]]) {
          const [x, y] = apply(transform, cx, cy);
          const at = [home.left + x, home.top + y];
          assert.ok(at[0] >= -1 && at[0] <= phone.width && at[1] >= -1, `${name} from ${drop} px lower: corner at ${at.map(Math.round)}`);
        }
      }
    }
  }
});

test('the next animation is picked at random, never the same as last time', () => {
  for (const last of [null, ...INTROS]) {
    const picked = new Set([0, 0.2, 0.4, 0.6, 0.8, 0.999].map((r) => pickIntro(last, () => r)));
    assert.ok(!picked.has(last), `picked ${last} again`);
    assert.equal(picked.size, 6, `${last}: ${[...picked]}`);
  }
  assert.equal(pickIntro('something old', () => 0), 'glide');
});
