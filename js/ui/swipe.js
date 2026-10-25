// Swiping a card sideways (spec §2, home screen): the card follows her finger, and a long or
// quick drag sends it off the side. Up-and-down drags are left to scroll the page.

const FAR = 0.25; // of the card's width
const QUICK = 0.5; // pixels per millisecond
const QUICK_MIN = 50; // pixels, so a twitch or a tap isn't a flick

// What a finished drag means: 'next' (to the left), 'previous' (to the right) or 'stay'.
export function swipeResult(dx, dy, ms, width) {
  if (Math.abs(dy) > Math.abs(dx)) return 'stay';
  const far = Math.abs(dx) > width * FAR;
  const quick = Math.abs(dx) > QUICK_MIN && Math.abs(dx) / Math.max(ms, 1) > QUICK;
  if (!far && !quick) return 'stay';
  return dx < 0 ? 'next' : 'previous';
}

// Browser only. `allowed(result)` says whether there is a card to go to; `onSwipe(result)`
// is called once the card has slid off.
export function attachSwipe(el, { allowed, onSwipe }) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let start = null;
  let dragging = false;
  let justDragged = false;

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    dragging = false;
    justDragged = false;
  });

  el.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    if (!dragging) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - start.y)) return;
      dragging = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
    }
    el.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`;
  });

  const end = (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const ms = performance.now() - start.t;
    start = null;
    if (!dragging) return;
    dragging = false;
    justDragged = true;
    el.classList.remove('dragging');
    const result = e.type === 'pointercancel' ? 'stay' : swipeResult(dx, dy, ms, el.offsetWidth);
    if (result === 'stay' || !allowed(result)) {
      el.style.transform = '';
      return;
    }
    if (reduceMotion) {
      onSwipe(result);
      return;
    }
    const off = (result === 'next' ? -1 : 1) * (el.offsetWidth + 60);
    el.style.transform = `translateX(${off}px) rotate(${off / 30}deg)`;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onSwipe(result);
    };
    el.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 400); // in case the transition never ends (the page was hidden)
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  // A drag that ends on a button isn't a tap on it.
  el.addEventListener('click', (e) => {
    if (!justDragged) return;
    justDragged = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}
