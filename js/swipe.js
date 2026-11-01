// Swipe right to go back, and left to go forward where there's somewhere to go (home to
// Wardrobe): the screen follows her finger, and letting go far enough across, or with a quick
// flick, does what Back (or the button forward) does. Only sideways swipes count: up and down
// stays the browser's scrolling (touch-action: pan-y in css/app.css), and a swipe that starts in
// a text box stays the text box's. A mouse drag works too, for trying it on a computer.

// How far the finger moves before it's taken as a sideways swipe or as scrolling, in pixels.
const DECIDE = 10;
// Letting go this far across the screen (a share of its width) goes...
const FAR = 1 / 3;
// ...and so does a flick: at least FLICK pixels a millisecond over the last FLICK_TIME ms.
const FLICK = 0.5;
const FLICK_TIME = 100;

const TEXT_BOXES = 'input, textarea, select, [contenteditable]';

// Watches `surface` for swipes. `backAction()` is what Back does on the screen now and
// `forwardAction()` where a swipe left goes, each null when there's nowhere to go that way;
// `width()` is the screen's width. `drag(px)` moves the screen px sideways as she swipes (to the
// right when px > 0). When she lets go, `release(go)` slides it the rest of the way and then runs
// `go`, the action; when `go` is null, it slides back into place.
export function watchSwipes(surface, { backAction, forwardAction = () => null, width, drag, release }) {
  // The action for a swipe right (way 1) or left (way -1).
  const actionFor = (way) => (way > 0 ? backAction() : forwardAction());
  // While a finger is down: where it started, which way the screen is following it (0 until
  // decided), and its recent positions (for flicks).
  let swipe = null;
  // The browser's tap when she lets go of a swipe isn't a tap on whatever is under her finger.
  let skipClick = false;

  surface.addEventListener('pointerdown', (event) => {
    swipe = null;
    skipClick = false;
    if (!event.isPrimary || event.button !== 0 || event.target.closest?.(TEXT_BOXES)) return;
    const { pointerId: id, clientX: x, clientY: y, timeStamp: t } = event;
    swipe = { id, x, y, way: 0, samples: [{ x, t }] };
  });

  surface.addEventListener('pointermove', (event) => {
    if (event.pointerId !== swipe?.id) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (!swipe.way) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < DECIDE) return;
      const way = Math.sign(dx);
      if (Math.abs(dx) <= Math.abs(dy) || !actionFor(way)) {
        swipe = null; // scrolling, or nowhere to go that way
        return;
      }
      swipe.way = way;
      skipClick = true;
      surface.setPointerCapture?.(swipe.id); // a mouse can leave the screen and still let go
    }
    swipe.samples.push({ x: event.clientX, t: event.timeStamp });
    drag(swipe.way > 0 ? Math.max(0, dx) : Math.min(0, dx));
  });

  surface.addEventListener('pointerup', (event) => {
    if (event.pointerId !== swipe?.id) return;
    const { x, way, samples } = swipe;
    swipe = null;
    if (!way) return;
    setTimeout(() => { skipClick = false; }); // that tap comes right after she lets go, or never
    const t = event.timeStamp;
    const recent = samples.find((sample) => t - sample.t <= FLICK_TIME);
    const speed = recent && t > recent.t ? (way * (event.clientX - recent.x)) / (t - recent.t) : 0;
    const action = actionFor(way);
    const goes = Boolean(action) && (way * (event.clientX - x) >= width() * FAR || speed >= FLICK);
    release(goes ? action : null);
  });

  surface.addEventListener('pointercancel', (event) => {
    if (event.pointerId !== swipe?.id) return;
    if (swipe.way) release(null);
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
