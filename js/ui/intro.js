// Opening the app: the name moves from where it was on the opening screen (big, on the left,
// halfway down) to its place at the top of the home screen, with one of 7 animations picked at
// random (never the same twice in a row), while the rest of the home screen fades in under it.

export const INTROS = ['glide', 'bounce', 'loop', 'spin', 'swing', 'pop', 'jelly'];
// The longest animation (ms), so a surprise that redraws the screen can wait for it to end.
export const INTRO_MAX_MS = 1700;

const FADE_MS = 400;
const SMOOTH = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

const round = (n) => Number(n.toFixed(4));
// Moves the name by (x, y) and scales it from its top-left corner (sy defaults to sx).
const place = (x, y, sx, sy = sx) => `translate(${round(x)}px, ${round(y)}px) scale(${round(sx)}, ${round(sy)})`;

// The name, moved and scaled like place(), then turned by `deg` around its middle.
const turned = (x, y, k, deg, { w, h }) =>
  `${place(x, y, k)} translate(${round(w / 2)}px, ${round(h / 2)}px) rotate(${round(deg)}deg) translate(${round(-w / 2)}px, ${round(-h / 2)}px)`;

// Each animation gets `s`, the name's start on the opening screen ({ x, y } from its place at
// the top, `k` how much bigger it was), and the name's size there ({ w, h }). Keyframes end at
// the name's place; every keyframe of one animation has the same list of steps, so the browser
// can blend them. Each one keeps the whole name on screen, even on a small phone.
const ANIMATIONS = {
  // Swoops out to the right as it rises, flies a little past its place, then settles.
  glide: (s) => ({
    duration: 1000,
    easing: 'linear',
    keyframes: [
      { offset: 0, transform: place(s.x, s.y, s.k), easing: 'ease-in-out' },
      { offset: 0.45, transform: place(s.x * 0.55 + 60, s.y * 0.45, (s.k + 1) / 2), easing: 'ease-in-out' },
      { offset: 0.75, transform: place(-8, -14, 1.06), easing: 'ease-in-out' },
      { offset: 0.88, transform: place(3, 4, 0.98), easing: 'ease-in-out' },
      { offset: 1, transform: place(0, 0, 1) },
    ],
  }),

  // Shoots up, hits the top with a squash and bounces down off it, smaller each time.
  bounce: (s, { w }) => {
    const down = (y) => place(0, y, 1);
    const squash = (sx, sy) => place(((1 - sx) * w) / 2, 0, sx, sy);
    return {
      duration: 1400,
      easing: 'linear',
      keyframes: [
        { offset: 0, transform: place(s.x, s.y, s.k), easing: 'cubic-bezier(0.5, 0, 1, 1)' },
        { offset: 0.3, transform: squash(1.12, 0.84), easing: 'ease-out' },
        { offset: 0.46, transform: down(60), easing: 'ease-in' },
        { offset: 0.6, transform: squash(1.07, 0.9), easing: 'ease-out' },
        { offset: 0.72, transform: down(26), easing: 'ease-in' },
        { offset: 0.82, transform: squash(1.03, 0.96), easing: 'ease-out' },
        { offset: 0.9, transform: down(10), easing: 'ease-in' },
        { offset: 0.96, transform: down(0), easing: 'ease-out' },
        { offset: 1, transform: down(0) },
      ],
    };
  },

  // Shrinks a little, does a big loop-the-loop down and around where it was, turning all the
  // way around with it like a rollercoaster, then flies up to its place. (Looping low leaves
  // room for the name standing on its end.)
  loop: (s, size) => {
    const steps = 36;
    const radius = 56;
    const small = 0.7;
    const keyframes = [];
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      let at;
      if (p <= 0.15) {
        at = [s.x, s.y, s.k + (small - s.k) * (p / 0.15), 0];
      } else if (p <= 0.75) {
        const t = (p - 0.15) / 0.6;
        const turn = 2 * Math.PI * t;
        at = [s.x + radius * (1 - Math.cos(turn)), s.y + radius * Math.sin(turn), small, -360 * t];
      } else {
        const f = (p - 0.75) / 0.25;
        at = [s.x * (1 - f), s.y * (1 - f), small + (1 - small) * f, -360];
      }
      keyframes.push({ offset: p, transform: turned(...at, size) });
    }
    return { duration: 1500, easing: 'ease-in-out', keyframes };
  },

  // Shrinks a little, spins two full turns on the way up, then wobbles at its place.
  spin: (s, size) => {
    const small = 0.8;
    return {
      duration: 1300,
      easing: 'linear',
      keyframes: [
        { offset: 0, transform: turned(s.x, s.y, s.k, -720, size), easing: 'ease-in' },
        { offset: 0.15, transform: turned(s.x, s.y, small, -720, size), easing: 'ease-in-out' },
        { offset: 0.65, transform: turned(s.x * 0.6, s.y * 0.6, small, 0, size), easing: 'ease-out' },
        { offset: 0.82, transform: turned(0, 0, 1.1, 6, size), easing: 'ease-in-out' },
        { offset: 0.92, transform: turned(0, 0, 0.97, -3, size), easing: 'ease-in-out' },
        { offset: 1, transform: turned(0, 0, 1, 0, size) },
      ],
    };
  },

  // Arrives a little low and swings like a sign hanging from the middle of its top edge,
  // wide at first, rising into its place as the swings get smaller.
  swing: (s, { w }) => {
    const at = (x, y, k, deg) => `${place(x, y, k)} translate(${round(w / 2)}px, 0px) rotate(${deg}deg) translate(${round(-w / 2)}px, 0px)`;
    const swings = [[0.47, 26], [0.6, -18], [0.71, 12], [0.81, -7], [0.9, 3]];
    return {
      duration: 1700,
      easing: 'linear',
      keyframes: [
        { offset: 0, transform: at(s.x, s.y, s.k, 0), easing: SMOOTH },
        { offset: 0.35, transform: at(0, 40, 1, 0), easing: 'ease-out' },
        ...swings.map(([offset, deg], i) => ({ offset, transform: at(0, 40 * (1 - (i + 1) / 6), 1, deg), easing: 'ease-in-out' })),
        { offset: 1, transform: at(0, 0, 1, 0) },
      ],
    };
  },

  // Shrinks away where it was, then pops back in at its place much bigger, with a wiggle.
  pop: (s, size) => {
    // Scaled by k from the middle of its left edge, and turned by deg, at its place.
    const popped = (k, deg) => turned(0, ((1 - k) * size.h) / 2, k, deg, size);
    return {
      duration: 1200,
      easing: 'linear',
      keyframes: [
        { offset: 0, transform: turned(s.x, s.y, s.k, 0, size), opacity: 1, easing: 'ease-in' },
        { offset: 0.25, transform: turned(s.x, s.y + (s.k * size.h) / 2, 0.001, 0, size), opacity: 0 },
        { offset: 0.3, transform: popped(0.001, 0), opacity: 0, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1.2)' },
        { offset: 0.6, transform: popped(1.4, -3), opacity: 1, easing: 'ease-in-out' },
        { offset: 0.74, transform: popped(0.88, 7), opacity: 1, easing: 'ease-in-out' },
        { offset: 0.86, transform: popped(1.08, -3), opacity: 1, easing: 'ease-in-out' },
        { offset: 1, transform: popped(1, 0), opacity: 1 },
      ],
    };
  },

  // Lands with a big squish and wobbles like jelly, stretching from its top-left corner.
  jelly: (s) => {
    const squish = (sx, sy) => place(0, 0, sx, sy);
    const wobbles = [[0.45, 1.45, 0.6], [0.57, 0.78, 1.28], [0.68, 1.22, 0.84], [0.78, 0.9, 1.1], [0.88, 1.05, 0.96]];
    return {
      duration: 1300,
      easing: 'linear',
      keyframes: [
        { offset: 0, transform: place(s.x, s.y, s.k), easing: 'cubic-bezier(0.4, 0, 1, 1)' },
        { offset: 0.35, transform: squish(1, 1), easing: 'ease-out' },
        ...wobbles.map(([offset, sx, sy]) => ({ offset, transform: squish(sx, sy), easing: 'ease-in-out' })),
        { offset: 1, transform: squish(1, 1) },
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
  // Everything else: what sits beside the name, beside its row, and so on up to `root`.
  const rest = [];
  for (let el = title; el !== root; el = el.parentElement) {
    rest.push(...[...el.parentElement.children].filter((other) => other !== el));
  }
  for (const el of rest) {
    el.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: FADE_MS, delay: duration * 0.55, easing: 'ease-out', fill: 'backwards' });
  }
  return true;
}
