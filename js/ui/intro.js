// Opening the app: the name moves from where it was on the opening screen (big, on the left,
// halfway down) to its place at the top of the home screen, with one of 7 animations picked at
// random (never the same twice in a row), while the rest of the home screen fades in under it.

export const INTROS = ['glide', 'bounce', 'loop', 'spin', 'swing', 'pop', 'jelly'];
// The longest animation (ms), so a surprise that redraws the screen can wait for it to end.
export const INTRO_MAX_MS = 1300;

const FADE_MS = 400;
const SMOOTH = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

const round = (n) => Number(n.toFixed(4));
// Moves the name by (x, y) and scales it from its top-left corner (sy defaults to sx).
const place = (x, y, sx, sy = sx) => `translate(${round(x)}px, ${round(y)}px) scale(${round(sx)}, ${round(sy)})`;

// Each animation gets `s`, the name's start on the opening screen ({ x, y } from its place at
// the top, `k` how much bigger it was), and the name's size there ({ w, h }). Keyframes end at
// the name's place; every keyframe of one animation has the same list of steps, so the browser
// can blend them.
const ANIMATIONS = {
  glide: (s) => ({
    duration: 600,
    easing: SMOOTH,
    keyframes: [{ transform: place(s.x, s.y, s.k) }, { transform: place(0, 0, 1) }],
  }),

  // Shoots up past its place and bounces down into it.
  bounce: (s) => ({
    duration: 1000,
    easing: 'linear',
    keyframes: [
      { offset: 0, transform: place(s.x, s.y, s.k), easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' },
      { offset: 0.5, transform: place(0, -18, 1), easing: 'ease-in' },
      { offset: 0.68, transform: place(0, 0, 1), easing: 'ease-out' },
      { offset: 0.8, transform: place(0, -7, 1), easing: 'ease-in' },
      { offset: 0.9, transform: place(0, 0, 1), easing: 'ease-out' },
      { offset: 0.95, transform: place(0, -2, 1), easing: 'ease-in' },
      { offset: 1, transform: place(0, 0, 1) },
    ],
  }),

  // A loop-the-loop on the way up, to the right of its path so it stays on screen.
  loop: (s) => {
    const steps = 24;
    const radius = 36;
    const keyframes = [];
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      const turn = 2 * Math.PI * Math.min(1, Math.max(0, (p - 0.2) / 0.6));
      keyframes.push({
        offset: p,
        transform: place(s.x * (1 - p) + radius * (1 - Math.cos(turn)), s.y * (1 - p) - radius * Math.sin(turn), s.k + (1 - s.k) * p),
      });
    }
    return { duration: 1200, easing: 'ease-in-out', keyframes };
  },

  // A full turn around its middle as it flies.
  spin: (s, { w, h }) => {
    const at = (x, y, k, deg) => `${place(x, y, k)} translate(${w / 2}px, ${h / 2}px) rotate(${deg}deg) translate(${-w / 2}px, ${-h / 2}px)`;
    return {
      duration: 850,
      easing: SMOOTH,
      keyframes: [{ transform: at(s.x, s.y, s.k, -360) }, { transform: at(0, 0, 1, 0) }],
    };
  },

  // Arrives, then swings like a sign hanging from the middle of its top edge.
  swing: (s, { w }) => {
    const at = (x, y, k, deg) => `${place(x, y, k)} translate(${w / 2}px, 0px) rotate(${deg}deg) translate(${-w / 2}px, 0px)`;
    return {
      duration: 1300,
      easing: 'linear',
      keyframes: [
        { offset: 0, transform: at(s.x, s.y, s.k, 0), easing: SMOOTH },
        { offset: 0.45, transform: at(0, 0, 1, 0), easing: 'ease-out' },
        { offset: 0.58, transform: at(0, 0, 1, 12), easing: 'ease-in-out' },
        { offset: 0.7, transform: at(0, 0, 1, -8), easing: 'ease-in-out' },
        { offset: 0.81, transform: at(0, 0, 1, 5), easing: 'ease-in-out' },
        { offset: 0.91, transform: at(0, 0, 1, -2), easing: 'ease-in-out' },
        { offset: 1, transform: at(0, 0, 1, 0) },
      ],
    };
  },

  // Shrinks away where it was and pops back in at its place.
  pop: (s, { w, h }) => {
    // Scaled by k around its middle, at its place.
    const around = (k) => place(((1 - k) * w) / 2, ((1 - k) * h) / 2, k);
    return {
      duration: 900,
      easing: 'linear',
      keyframes: [
        { offset: 0, transform: place(s.x, s.y, s.k), opacity: 1, easing: 'ease-in' },
        { offset: 0.3, transform: place(s.x + (s.k * w) / 2, s.y + (s.k * h) / 2, 0.001), opacity: 0 },
        { offset: 0.34, transform: around(0.001), opacity: 0, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1.2)' },
        { offset: 0.72, transform: around(1.12), opacity: 1, easing: 'ease-in-out' },
        { offset: 0.86, transform: around(0.96), opacity: 1, easing: 'ease-in-out' },
        { offset: 1, transform: place(0, 0, 1), opacity: 1 },
      ],
    };
  },

  // Lands with a squish and wobbles like jelly, stretching from its top-left corner so it stays
  // on screen.
  jelly: (s) => {
    const squish = (sx, sy) => place(0, 0, sx, sy);
    return {
      duration: 1100,
      easing: 'linear',
      keyframes: [
        { offset: 0, transform: place(s.x, s.y, s.k), easing: 'cubic-bezier(0.4, 0, 1, 1)' },
        { offset: 0.42, transform: place(0, 0, 1), easing: 'ease-out' },
        { offset: 0.54, transform: squish(1.28, 0.72), easing: 'ease-in-out' },
        { offset: 0.68, transform: squish(0.86, 1.16), easing: 'ease-in-out' },
        { offset: 0.82, transform: squish(1.07, 0.94), easing: 'ease-in-out' },
        { offset: 0.92, transform: squish(0.98, 1.02), easing: 'ease-in-out' },
        { offset: 1, transform: place(0, 0, 1) },
      ],
    };
  },
};

// The animation `name` for a name that was at `from` on the opening screen and is now at `to`
// ({ left, top, fontSize } in pixels), `size` being its size now ({ width, height }).
export function introFor(name, from, to, size) {
  const start = { x: from.left - to.left, y: from.top - to.top, k: from.fontSize / to.fontSize };
  return ANIMATIONS[name](start, { w: size.width, h: size.height });
}

// A random animation other than the `last` one.
export function pickIntro(last, random = Math.random) {
  const choices = INTROS.filter((name) => name !== last);
  return choices[Math.floor(random() * choices.length)];
}

// Where `el` is on screen and how big its letters are.
export function spotOf(el) {
  const { left, top } = el.getBoundingClientRect();
  return { left, top, fontSize: parseFloat(getComputedStyle(el).fontSize) };
}

// Plays animation `name` on the home screen just drawn in `root`. False when it can't (no name
// to move, or the phone asks for less motion), so the caller fades the screen in instead.
export function playIntro(root, from, name) {
  const title = root.querySelector('.app-name h1');
  if (!title || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  const { duration, easing, keyframes } = introFor(name, from, spotOf(title), { width: title.offsetWidth, height: title.offsetHeight });
  title.animate(keyframes, { duration, easing });
  const rest = [
    ...[...root.children].filter((el) => !el.contains(title)),
    ...root.querySelectorAll('.topbar > :not(.app-name), .app-name .pencil'),
  ];
  for (const el of rest) {
    el.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: FADE_MS, delay: duration * 0.55, easing: 'ease-out', fill: 'backwards' });
  }
  return true;
}
