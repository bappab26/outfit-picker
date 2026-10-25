// The color list, how colors go together, and detecting a photo's main color.
import { SETTINGS } from './settings.js';

export const NEUTRALS = ['black', 'white', 'grey', 'beige', 'brown', 'navy', 'denim'];
// Bold colors in color-wheel order; pink wraps around to red.
export const BOLDS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];
export const COLORS = [...NEUTRALS, ...BOLDS];

export const SWATCHES = {
  black: '#1b1b1b',
  white: '#f7f7f5',
  grey: '#8c8c8c',
  beige: '#d9c7a7',
  brown: '#7a5230',
  navy: '#1f2a44',
  denim: '#4f6d8f',
  red: '#c8312f',
  orange: '#e8812a',
  yellow: '#e9c93b',
  green: '#3f8f4e',
  blue: '#2f6fd1',
  purple: '#7a3fa0',
  pink: '#e994b8',
};

export function isNeutral(color) {
  return NEUTRALS.includes(color);
}

// Steps between two bold colors around the wheel: 0 (same) to 3 (opposite).
export function wheelDistance(a, b) {
  const d = Math.abs(BOLDS.indexOf(a) - BOLDS.indexOf(b));
  return Math.min(d, BOLDS.length - d);
}

export function pairColorPoints(a, b) {
  const p = SETTINGS.colorPoints;
  if (isNeutral(a) || isNeutral(b)) return p.neutral;
  const d = wheelDistance(a, b);
  if (d === 0) return p.same;
  if (d === 1) return p.adjacent;
  if (d === 3) return p.opposite;
  return p.other;
}

function toHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

// The closest color name for one pixel. The first matching rule wins.
export function nameColor(r, g, b) {
  const { h, s, l } = toHsl(r, g, b);
  if (l < 0.15) return 'black';
  if (l > 0.9) return 'white';
  if (s < 0.15) return l > 0.8 ? 'white' : 'grey';
  if (h >= 25 && h <= 55 && s <= 0.55 && l >= 0.65) return 'beige';
  if (h >= 10 && h <= 45 && l < 0.45) return 'brown';
  if (h >= 200 && h <= 250 && l < 0.3) return 'navy';
  if (h >= 195 && h <= 230 && s <= 0.5 && l >= 0.3 && l <= 0.6) return 'denim';
  if (h >= 330 || h < 15) return l > 0.65 ? 'pink' : 'red';
  if (h < 40) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 170) return 'green';
  if (h < 260) return 'blue';
  if (h < 290) return 'purple';
  return l > 0.55 ? 'pink' : 'purple';
}

// The main color of an image (RGBA pixels), ignoring a plain background.
export function detectColor(rgba, width, height) {
  const opaque = (i) => rgba[i + 3] >= 128;

  // Background: the average of the border pixels.
  let br = 0;
  let bg = 0;
  let bb = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x !== 0 && y !== 0 && x !== width - 1 && y !== height - 1) continue;
      const i = (y * width + x) * 4;
      if (!opaque(i)) continue;
      br += rgba[i];
      bg += rgba[i + 1];
      bb += rgba[i + 2];
      count++;
    }
  }
  if (count) {
    br /= count;
    bg /= count;
    bb /= count;
  }

  const all = [];
  const kept = [];
  for (let i = 0; i < width * height * 4; i += 4) {
    if (!opaque(i)) continue;
    all.push(i);
    const dist = Math.hypot(rgba[i] - br, rgba[i + 1] - bg, rgba[i + 2] - bb);
    if (!count || dist > 40) kept.push(i);
  }
  const pixels = kept.length >= width * height * 0.05 ? kept : all;

  const tally = new Map();
  for (const i of pixels) {
    const name = nameColor(rgba[i], rgba[i + 1], rgba[i + 2]);
    tally.set(name, (tally.get(name) ?? 0) + 1);
  }
  let best = COLORS[0];
  let bestCount = -1;
  for (const c of COLORS) {
    const n = tally.get(c) ?? 0;
    if (n > bestCount) {
      best = c;
      bestCount = n;
    }
  }
  return best;
}

// Browser only: the main color of a photo, measured on a 48×48 copy.
export async function detectImageColor(blob) {
  const size = 48;
  const bitmap = await createImageBitmap(blob);
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(size, size)
    : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, size, size);
  return detectColor(ctx.getImageData(0, 0, size, size).data, size, size);
}
