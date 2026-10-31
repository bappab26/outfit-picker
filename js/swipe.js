// Swipe right to go back: the screen follows her finger, and letting go far enough across, or
// with a quick flick, does what the Back button does. Only sideways swipes count: up and down
// stays the browser's scrolling (touch-action: pan-y in css/app.css), and a swipe that starts in
// a text box stays the text box's. A mouse drag works too, for trying it on a computer.

// How far the finger moves before it's taken as a sideways swipe or as scrolling, in pixels.
const DECIDE = 10;
// Letting go this far across the screen (a share of its width) goes back...
const FAR = 1 / 3;
// ...and so does a flick: at least FLICK pixels a millisecond over the last FLICK_TIME ms.
const FLICK = 0.5;
const FLICK_TIME = 100;

const TEXT_BOXES = 'input, textarea, select, [contenteditable]';

// Watches `surface` for swipes. `backAction()` is what Back does on the screen now, or null when
// there's nothing to go back to; `width()` is the screen's width. `drag(px)` moves the screen px
// to the right as she swipes, and `release(wentBack)` puts it back in place when she lets go
// (when it went back, after Back has drawn the screen she swiped to).
export function watchSwipes(surface, { backAction, width, drag, release }) {
  // While a finger is down: where it started, whether the screen is following it, and its
  // recent positions (for flicks).
  let swipe = null;
  // The browser's tap when she lets go of a swipe isn't a tap on whatever is under her finger.
  let skipClick = false;

  surface.addEventListener('pointerdown', (event) => {
    swipe = null;
    skipClick = false;
    if (!event.isPrimary || event.button !== 0 || event.target.closest?.(TEXT_BOXES)) return;
    const { pointerId: id, clientX: x, clientY: y, timeStamp: t } = event;
    swipe = { id, x, y, sliding: false, samples: [{ x, t }] };
  });

  surface.addEventListener('pointermove', (event) => {
    if (event.pointerId !== swipe?.id) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (!swipe.sliding) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < DECIDE) return;
      if (dx <= Math.abs(dy) || !backAction()) {
        swipe = null; // scrolling, a swipe to the left, or nothing to go back to
        return;
      }
      swipe.sliding = true;
      skipClick = true;
      surface.setPointerCapture?.(swipe.id); // a mouse can leave the screen and still let go
    }
    swipe.samples.push({ x: event.clientX, t: event.timeStamp });
    drag(Math.max(0, dx));
  });

  surface.addEventListener('pointerup', (event) => {
    if (event.pointerId !== swipe?.id) return;
    const { x, sliding, samples } = swipe;
    swipe = null;
    if (!sliding) return;
    setTimeout(() => { skipClick = false; }); // that tap comes right after she lets go, or never
    const t = event.timeStamp;
    const recent = samples.find((sample) => t - sample.t <= FLICK_TIME);
    const speed = recent && t > recent.t ? (event.clientX - recent.x) / (t - recent.t) : 0;
    const action = backAction();
    const goes = Boolean(action) && (event.clientX - x >= width() * FAR || speed >= FLICK);
    if (goes) action();
    release(goes);
  });

  surface.addEventListener('pointercancel', (event) => {
    if (event.pointerId !== swipe?.id) return;
    if (swipe.sliding) release(false);
    swipe = null;
    skipClick = false; // no tap follows
  });

  surface.addEventListener('click', (event) => {
    if (!skipClick) return;
    skipClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}
