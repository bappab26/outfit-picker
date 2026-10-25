// Draws the app icons (a white T-shirt on the theme color) as PNG files:
//   node scripts/make-icons.mjs
// Uses only Node's built-in modules, so there is nothing to install.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BACKGROUND = [0x7a, 0x4e, 0x6e]; // --accent in css/app.css
const SHIRT = [0xff, 0xff, 0xff];
const SAMPLES = 4; // per pixel side, for smooth edges

// The T-shirt, in a 0–1 square: sleeves across the top, body below, a round neck cut out.
function onShirt(x, y) {
  const sleeves = x >= 0.2 && x <= 0.8 && y >= 0.28 && y <= 0.46;
  const body = x >= 0.33 && x <= 0.67 && y >= 0.28 && y <= 0.76;
  const neck = (x - 0.5) ** 2 + (y - 0.28) ** 2 < 0.075 ** 2;
  return (sleeves || body) && !neck;
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
      let hits = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          if (onShirt((px + (sx + 0.5) / SAMPLES) / size, (py + (sy + 0.5) / SAMPLES) / size)) hits++;
        }
      }
      const t = hits / (SAMPLES * SAMPLES);
      for (let ch = 0; ch < 3; ch++) {
        raw[row + 1 + px * 3 + ch] = Math.round(BACKGROUND[ch] + (SHIRT[ch] - BACKGROUND[ch]) * t);
      }
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
