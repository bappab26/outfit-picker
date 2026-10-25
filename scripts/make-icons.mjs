// Draws the app icons (a white hanger with little red devil horns on the theme color) as PNG files:
//   node scripts/make-icons.mjs
// Uses only Node's built-in modules, so there is nothing to install.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BACKGROUND = [0x29, 0x13, 0x3f]; // --bg in css/app.css
const HANGER = [0xff, 0xff, 0xff];
const HORN = [0xff, 0x4d, 0x6d];
const SAMPLES = 4; // per pixel side, for smooth edges

// Everything below is in a 0–1 square, y going down.
const LINE = 0.068; // thickness of the hanger
const HOOK = { x: 0.5, y: 0.36, r: 0.085 };
const NECK = [0.5, 0.51];
const LEFT = [0.14, 0.79];
const RIGHT = [0.86, 0.79];
// Degrees around the hook (0 = right, 90 = down) left open: the hook's gap at the bottom left.
const HOOK_GAP = [90, 160];

function toSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

const atAngle = (degrees, r = HOOK.r) => [
  HOOK.x + r * Math.cos((degrees * Math.PI) / 180),
  HOOK.y + r * Math.sin((degrees * Math.PI) / 180),
];

// The hook (a ring with a gap, rounded at its end), its stem, and the triangle below.
function onHanger(x, y) {
  const angle = (Math.atan2(y - HOOK.y, x - HOOK.x) * 180) / Math.PI;
  const inGap = angle > HOOK_GAP[0] && angle < HOOK_GAP[1];
  if (!inGap && Math.abs(Math.hypot(x - HOOK.x, y - HOOK.y) - HOOK.r) <= LINE / 2) return true;
  const [ex, ey] = atAngle(HOOK_GAP[1]);
  if (Math.hypot(x - ex, y - ey) <= LINE / 2) return true;
  const lines = [[atAngle(90), NECK], [NECK, LEFT], [NECK, RIGHT], [LEFT, RIGHT]];
  return lines.some(([a, b]) => toSegment(x, y, a, b) <= LINE / 2);
}

// Two short horns on top of the hook, curving out and then up to a point.
// Each is a curved line that gets thinner from its base to its tip.
const LEFT_HORN = {
  base: atAngle(-135),
  bend: [HOOK.x - 0.125, HOOK.y - 0.11],
  tip: [HOOK.x - 0.08, HOOK.y - 0.205],
  width: 0.058,
};
const HORNS = [LEFT_HORN, {
  base: [1 - LEFT_HORN.base[0], LEFT_HORN.base[1]],
  bend: [1 - LEFT_HORN.bend[0], LEFT_HORN.bend[1]],
  tip: [1 - LEFT_HORN.tip[0], LEFT_HORN.tip[1]],
  width: LEFT_HORN.width,
}];
const HORN_STEPS = 40;

function onHorn(x, y) {
  return HORNS.some(({ base, bend, tip, width }) => {
    if (x < Math.min(base[0], bend[0], tip[0]) - width || x > Math.max(base[0], bend[0], tip[0]) + width) return false;
    if (y < Math.min(base[1], bend[1], tip[1]) - width || y > Math.max(base[1], bend[1], tip[1]) + width) return false;
    for (let i = 0; i <= HORN_STEPS; i++) {
      const t = i / HORN_STEPS;
      const px = (1 - t) ** 2 * base[0] + 2 * (1 - t) * t * bend[0] + t ** 2 * tip[0];
      const py = (1 - t) ** 2 * base[1] + 2 * (1 - t) * t * bend[1] + t ** 2 * tip[1];
      if (Math.hypot(x - px, y - py) <= width * (1 - t) + 0.004) return true;
    }
    return false;
  });
}

// The color at one point: the hanger in front, so the horns seem to grow out from behind the hook.
function colorAt(x, y) {
  if (onHanger(x, y)) return HANGER;
  const inHookHole = Math.hypot(x - HOOK.x, y - HOOK.y) < HOOK.r;
  if (!inHookHole && onHorn(x, y)) return HORN;
  return BACKGROUND;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  typed.copy(out, 4);
  out.writeUInt32BE(crc32(typed), 8 + data.length);
  return out;
}

function drawPng(size) {
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let py = 0; py < size; py++) {
    const row = py * (1 + size * 3);
    raw[row] = 0; // no filter
    for (let px = 0; px < size; px++) {
      // The average color of SAMPLES × SAMPLES points inside the pixel.
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const color = colorAt((px + (sx + 0.5) / SAMPLES) / size, (py + (sy + 0.5) / SAMPLES) / size);
          for (let ch = 0; ch < 3; ch++) sum[ch] += color[ch];
        }
      }
      for (let ch = 0; ch < 3; ch++) raw[row + 1 + px * 3 + ch] = Math.round(sum[ch] / (SAMPLES * SAMPLES));
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits per channel
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = new URL('../icons/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(name, dir), drawPng(size));
  console.log(`wrote icons/${name}`);
}
