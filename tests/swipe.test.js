import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchSwipes } from '../js/swipe.js';

const plain = { closest: () => null };
const textBox = { closest: (selector) => (selector.includes('textarea') ? {} : null) };

// A screen 375 px wide, and what happened on it: Back or forward taken, how far it slid, how it
// was let go.
function screen({ canGoBack = () => true, canGoForward = () => false } = {}) {
  const listeners = {};
  const surface = { addEventListener: (type, fn) => (listeners[type] ??= []).push(fn) };
  const seen = { backs: 0, forwards: 0, drags: [], releases: [], order: [] };
  watchSwipes(surface, {
    backAction: () => (canGoBack() ? () => (seen.backs++, seen.order.push('back')) : null),
    forwardAction: () => (canGoForward() ? () => seen.forwards++ : null),
    width: () => 375,
    drag: (px) => seen.drags.push(px),
    // Like the app: the screens slide the rest of the way, then Back (or forward) runs.
    release: (go) => {
      seen.releases.push(Boolean(go));
      seen.order.push('release');
      go?.();
    },
  });
  const fire = (type, x, y, t, extra = {}) => {
    const event = {
      pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, timeStamp: t, target: plain,
      stopped: false, prevented: false,
      stopPropagation() { this.stopped = true; },
      preventDefault() { this.prevented = true; },
      ...extra,
    };
    for (const fn of listeners[type] ?? []) fn(event);
    return event;
  };
  return { seen, fire };
}

// A finger down at `from`, through each [x, y] point one every `step` ms, then let go there.
function swipe(fire, points, { from = [40, 300], step = 200 } = {}) {
  let t = 1000;
  fire('pointerdown', ...from, t);
  for (const [x, y] of points) fire('pointermove', x, y, (t += step));
  fire('pointerup', ...points.at(-1), t + step);
}

test('a swipe right past a third of the screen goes back, the screen following the finger', () => {
  const { seen, fire } = screen();
  swipe(fire, [[60, 302], [120, 305], [180, 306]]);
  assert.equal(seen.backs, 1);
  assert.deepEqual(seen.drags, [20, 80, 140]);
  assert.deepEqual(seen.releases, [true]);
});

test('going back, Back is handed over to run once the screens have slid the rest of the way', () => {
  const { seen, fire } = screen();
  swipe(fire, [[60, 302], [120, 305], [180, 306]]);
  assert.deepEqual(seen.order, ['release', 'back']);
});

test('a short, slow swipe slides back into place without going back', () => {
  const { seen, fire } = screen();
  swipe(fire, [[60, 300], [100, 300]]);
  assert.equal(seen.backs, 0);
  assert.deepEqual(seen.releases, [false]);
});

test('a quick flick goes back, even a short one', () => {
  const { seen, fire } = screen();
  swipe(fire, [[55, 300], [75, 300], [95, 300]], { step: 20 });
  assert.equal(seen.backs, 1);
});

test('a finger held still before letting go is not a flick', () => {
  const { seen, fire } = screen();
  fire('pointerdown', 40, 300, 1000);
  fire('pointermove', 95, 300, 1060);
  fire('pointerup', 95, 300, 1600);
  assert.equal(seen.backs, 0);
});

test('scrolling up and down never goes back, even when the finger then moves sideways', () => {
  const { seen, fire } = screen();
  swipe(fire, [[42, 330], [250, 340]]);
  assert.equal(seen.backs, 0);
  assert.deepEqual(seen.drags, []);
  assert.deepEqual(seen.releases, []);
});

test('where there is somewhere to go forward (home to Wardrobe), a swipe left past a third of the screen goes there', () => {
  const { seen, fire } = screen({ canGoBack: () => false, canGoForward: () => true });
  swipe(fire, [[280, 302], [220, 305], [160, 306]], { from: [300, 300] });
  assert.equal(seen.forwards, 1);
  assert.equal(seen.backs, 0);
  assert.deepEqual(seen.drags, [-20, -80, -140]);
  assert.deepEqual(seen.releases, [true]);
});

test('a quick flick left goes forward too, and a short slow one slides back', () => {
  const flick = screen({ canGoForward: () => true });
  swipe(flick.fire, [[285, 300], [265, 300], [245, 300]], { from: [300, 300], step: 20 });
  assert.equal(flick.seen.forwards, 1);

  const slow = screen({ canGoForward: () => true });
  swipe(slow.fire, [[280, 300], [240, 300]], { from: [300, 300] });
  assert.equal(slow.seen.forwards, 0);
  assert.deepEqual(slow.seen.releases, [false]);
});

test('the screen never slides past where it started, whichever way it goes', () => {
  const right = screen();
  swipe(right.fire, [[100, 300], [10, 300]]);
  assert.deepEqual(right.seen.drags, [60, 0]);

  const left = screen({ canGoBack: () => false, canGoForward: () => true });
  swipe(left.fire, [[240, 300], [330, 300]], { from: [300, 300] });
  assert.deepEqual(left.seen.drags, [-60, 0]);
});

test('a swipe left with nowhere forward does nothing', () => {
  const { seen, fire } = screen();
  swipe(fire, [[250, 300], [60, 300]], { from: [300, 300] });
  assert.equal(seen.backs, 0);
  assert.deepEqual(seen.drags, []);
});

test('with nothing to go back to (the home screen, a big photo open), the screen stays still', () => {
  const { seen, fire } = screen({ canGoBack: () => false });
  swipe(fire, [[60, 302], [120, 305], [180, 306]]);
  assert.equal(seen.backs, 0);
  assert.deepEqual(seen.drags, []);
  assert.deepEqual(seen.releases, []);
});

test('if Back has nothing to do by the time she lets go, the screen slides back', () => {
  let canGoBack = true;
  const { seen, fire } = screen({ canGoBack: () => canGoBack });
  fire('pointerdown', 40, 300, 1000);
  fire('pointermove', 200, 300, 1200);
  canGoBack = false;
  fire('pointerup', 200, 300, 1400);
  assert.equal(seen.backs, 0);
  assert.deepEqual(seen.releases, [false]);
});

test('a swipe that starts in a text box is left to the text box', () => {
  const { seen, fire } = screen();
  fire('pointerdown', 40, 300, 1000, { target: textBox });
  fire('pointermove', 200, 300, 1200);
  fire('pointerup', 200, 300, 1400);
  assert.equal(seen.backs, 0);
  assert.deepEqual(seen.drags, []);
});

test('when the browser takes the touch to scroll, the screen slides back', () => {
  const { seen, fire } = screen();
  fire('pointerdown', 40, 300, 1000);
  fire('pointermove', 80, 300, 1100);
  fire('pointercancel', 80, 300, 1150);
  assert.equal(seen.backs, 0);
  assert.deepEqual(seen.releases, [false]);
});

test('a second finger, or a right-click drag, never moves the screen', () => {
  const { seen, fire } = screen();
  fire('pointerdown', 40, 300, 1000);
  fire('pointermove', 60, 300, 1100);
  fire('pointermove', 300, 300, 1150, { pointerId: 2, isPrimary: false });
  assert.deepEqual(seen.drags, [20]);

  const mouse = screen();
  mouse.fire('pointerdown', 40, 300, 1000, { button: 2 });
  mouse.fire('pointermove', 200, 300, 1200, { button: 2 });
  mouse.fire('pointerup', 200, 300, 1400, { button: 2 });
  assert.deepEqual(mouse.seen.drags, []);
});

test('after a swipe, the tap the browser sees as she lets go is ignored, and the next tap works', () => {
  const { fire } = screen();
  swipe(fire, [[60, 300], [100, 300]]);
  const afterSwipe = fire('click', 100, 300, 1700);
  assert.ok(afterSwipe.stopped && afterSwipe.prevented);

  fire('pointerdown', 100, 300, 3000);
  fire('pointerup', 100, 300, 3080);
  const tap = fire('click', 100, 300, 3080);
  assert.ok(!tap.stopped && !tap.prevented);
});

test('a later tap with no finger down first (a key press) still works after a swipe', async () => {
  const { fire } = screen();
  swipe(fire, [[60, 300], [100, 300]]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const key = fire('click', 100, 300, 5000);
  assert.ok(!key.stopped && !key.prevented);

  fire('pointerdown', 40, 300, 6000);
  fire('pointermove', 80, 300, 6100);
  fire('pointercancel', 80, 300, 6150);
  const afterCancel = fire('click', 100, 300, 7000);
  assert.ok(!afterCancel.stopped && !afterCancel.prevented);
});
