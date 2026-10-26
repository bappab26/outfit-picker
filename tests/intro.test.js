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

test('the next animation is picked at random, never the same as last time', () => {
  for (const last of [null, ...INTROS]) {
    const picked = new Set([0, 0.2, 0.4, 0.6, 0.8, 0.999].map((r) => pickIntro(last, () => r)));
    assert.ok(!picked.has(last), `picked ${last} again`);
    assert.equal(picked.size, 6, `${last}: ${[...picked]}`);
  }
  assert.equal(pickIntro('something old', () => 0), 'glide');
});
