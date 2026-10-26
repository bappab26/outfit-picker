// Opening the app: the name glides from where it was on the opening screen (big, on the left,
// halfway down) up to its place at the top of the home screen, shrinking as it goes, while the
// rest of the home screen fades in under it.

const GLIDE_MS = 600;
const FADE_MS = 400;
const FADE_DELAY_MS = 250;

// The transform that puts the home screen's name back where the opening screen's name was.
// `from` and `to` are { left, top, fontSize } in pixels (the name scales from its top-left corner).
export function glideFrom(from, to) {
  const scale = Number((from.fontSize / to.fontSize).toFixed(4));
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`;
}

// Where `el` is on screen and how big its letters are.
export function spotOf(el) {
  const { left, top } = el.getBoundingClientRect();
  return { left, top, fontSize: parseFloat(getComputedStyle(el).fontSize) };
}

// Runs the glide on the home screen just drawn in `root`. False when it can't (no name to
// glide, or the phone asks for less motion), so the caller fades the screen in instead.
export function glideTitle(root, from) {
  const title = root.querySelector('.app-name h1');
  if (!title || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  title.animate([{ transform: glideFrom(from, spotOf(title)) }, { transform: 'none' }],
    { duration: GLIDE_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  const rest = [
    ...[...root.children].filter((el) => !el.contains(title)),
    ...root.querySelectorAll('.topbar > :not(.app-name), .app-name .pencil'),
  ];
  for (const el of rest) {
    el.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: FADE_MS, delay: FADE_DELAY_MS, easing: 'ease-out', fill: 'backwards' });
  }
  return true;
}
