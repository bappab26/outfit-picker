// A short message at the top of the screen, and confetti (birthday, milestones). Both sit
// outside the app's screen, so redrawing it doesn't cut them short.
import { h } from './dom.js';

const CONFETTI_COLORS = ['#ff6b81', '#ffd166', '#7bdff2', '#b388ff', '#95e06c', '#ffffff'];
let shown = null;

export function toast(text, ms = 2500) {
  shown?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, text);
  document.body.append(el);
  shown = el;
  setTimeout(() => el.remove(), ms);
}

// Skipped when the phone asks for less motion.
export function confetti(pieces = 90) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < pieces; i++) {
    const random = (min, max) => min + Math.random() * (max - min);
    layer.append(h('i', {
      style: [
        `left:${random(0, 100)}%`,
        `background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`,
        `animation-duration:${random(2.2, 3.8)}s`,
        `animation-delay:${random(0, 0.8)}s`,
        `--drift:${random(-60, 60)}px`,
        `--spin:${random(360, 1080)}deg`,
      ].join(';'),
    }));
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 5000);
}
