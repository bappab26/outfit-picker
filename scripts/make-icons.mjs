// Draws the app icons as PNG files: the picture in logo-source.png (Hello Kitty) cut out like a
// sticker, with a white edge, on the theme color.
//   node scripts/make-icons.mjs
// Uses only Node's built-in modules, so there is nothing to install. To change the logo, put
// another picture with a plain white background in logo-source.png (a PNG) and run it again.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const BACKGROUND = [0x29, 0x13, 0x3f]; // --bg in css/app.css
const SOURCE = new URL('logo-source.png', import.meta.url);
const LOGO_WIDTH = 0.84; // of the icon's width
const EDGE = 0.02; // the sticker's white edge, as a share of the picture's width
// Pixels at least this light in red, green and blue that join the picture's border are
// background; the white inside her outline is not, since the outline closes it in.
const LIGHT = 215;
const SAMPLES = 6; // per pixel side, for smooth edges

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

// An 8-bit RGB or RGBA PNG (not interlaced) → { width, height, channels, data }, data being
// the pixels row by row.
export function decodePng(png) {
  let width = 0;
  let height = 0;
  let channels = 0;
  const parts = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0) throw new Error('only 8-bit, non-interlaced PNGs');
      channels = { 2: 3, 6: 4 }[body[9]];
      if (!channels) throw new Error('only RGB or RGBA PNGs');
    }
    if (type === 'IDAT') parts.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x];
      const left = x >= channels ? data[y * stride + x - channels] : 0;
      const up = y > 0 ? data[(y - 1) * stride + x] : 0;
      const upLeft = x >= channels && y > 0 ? data[(y - 1) * stride + x - channels] : 0;
      let guess = 0;
      if (filter === 1) guess = left;
      else if (filter === 2) guess = up;
      else if (filter === 3) guess = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const [a, b, c] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
        guess = a <= b && a <= c ? left : b <= c ? up : upLeft;
      }
      data[y * stride + x] = (value + guess) & 0xff;
    }
  }
  return { width, height, channels, data };
}

function encodePng(size, rgb) {
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (1 + size * 3) + 1, y * size * 3, (y + 1) * size * 3);
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

// The picture as a sticker: her colors where she is, white around her for the sticker's edge,
// and `alpha` (0–1) fading out at the edge. A margin is added on every side for the edge.
function sticker(picture) {
  const edge = EDGE * picture.width;
  const margin = Math.ceil(edge) + 2;
  const width = picture.width + 2 * margin;
  const height = picture.height + 2 * margin;
  const colorAt = (x, y) => picture.data.subarray((y * picture.width + x) * picture.channels, (y * picture.width + x) * picture.channels + 3);

  // Background: light pixels reached from the border, one step left, right, up or down at a time.
  const background = new Uint8Array(picture.width * picture.height);
  const queue = [];
  const reach = (x, y) => {
    const i = y * picture.width + x;
    if (background[i] || Math.min(...colorAt(x, y)) < LIGHT) return;
    background[i] = 1;
    queue.push(i);
  };
  for (let x = 0; x < picture.width; x++) { reach(x, 0); reach(x, picture.height - 1); }
  for (let y = 0; y < picture.height; y++) { reach(0, y); reach(picture.width - 1, y); }
  while (queue.length) {
    const i = queue.pop();
    const [x, y] = [i % picture.width, Math.floor(i / picture.width)];
    if (x > 0) reach(x - 1, y);
    if (x < picture.width - 1) reach(x + 1, y);
    if (y > 0) reach(x, y - 1);
    if (y < picture.height - 1) reach(x, y + 1);
  }

  // How far each pixel is from her, in pixels (two passes, stepping straight or diagonally).
  const distance = new Float32Array(width * height).fill(Infinity);
  for (let y = 0; y < picture.height; y++) {
    for (let x = 0; x < picture.width; x++) {
      if (!background[y * picture.width + x]) distance[(y + margin) * width + x + margin] = 0;
    }
  }
  const steps = [[-1, 0, 1], [0, -1, 1], [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2]];
  const pass = (forward) => {
    for (let n = 0; n < width * height; n++) {
      const i = forward ? n : width * height - 1 - n;
      const [x, y] = [i % width, Math.floor(i / width)];
      for (const [sx, sy, cost] of steps) {
        const [nx, ny] = forward ? [x + sx, y + sy] : [x - sx, y - sy];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        distance[i] = Math.min(distance[i], distance[ny * width + nx] + cost);
      }
    }
  };
  pass(true);
  pass(false);

  const color = new Float32Array(width * height * 3).fill(255);
  const alpha = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      alpha[i] = Math.min(1, Math.max(0, edge + 0.5 - distance[i]));
      const [px, py] = [x - margin, y - margin];
      if (px >= 0 && py >= 0 && px < picture.width && py < picture.height && !background[py * picture.width + px]) {
        color.set(colorAt(px, py), i * 3);
      }
    }
  }
  return { width, height, color, alpha };
}

// The sticker in the middle of a `size` square of the theme color.
function drawIcon(size, art) {
  const scale = (LOGO_WIDTH * size) / art.width;
  const [left, top] = [(size - art.width * scale) / 2, (size - art.height * scale) / 2];
  const rgb = Buffer.alloc(size * size * 3);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0];
      let cover = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = Math.floor((px + (sx + 0.5) / SAMPLES - left) / scale);
          const y = Math.floor((py + (sy + 0.5) / SAMPLES - top) / scale);
          if (x < 0 || y < 0 || x >= art.width || y >= art.height) continue;
          const a = art.alpha[y * art.width + x];
          for (let ch = 0; ch < 3; ch++) sum[ch] += art.color[(y * art.width + x) * 3 + ch] * a;
          cover += a;
        }
      }
      const n = SAMPLES * SAMPLES;
      for (let ch = 0; ch < 3; ch++) {
        rgb[(py * size + px) * 3 + ch] = Math.round((sum[ch] + BACKGROUND[ch] * (n - cover)) / n);
      }
    }
  }
  return encodePng(size, rgb);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const art = sticker(decodePng(readFileSync(SOURCE)));
  const dir = new URL('../icons/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    writeFileSync(new URL(name, dir), drawIcon(size, art));
    console.log(`wrote icons/${name}`);
  }
}
