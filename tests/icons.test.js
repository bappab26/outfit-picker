import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodePng } from '../scripts/make-icons.mjs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url));

for (const [file, size] of [['icons/icon-192.png', 192], ['icons/icon-512.png', 512], ['icons/apple-touch-icon.png', 180]]) {
  test(`${file} is a ${size}px PNG`, () => {
    const png = read(file);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), size); // IHDR width
    assert.equal(png.readUInt32BE(20), size); // IHDR height
  });

  test(`${file} shows Hello Kitty as a sticker on the theme color`, () => {
    const { width, height, channels, data } = decodePng(read(file));
    const px = (x, y) => [...data.subarray((y * width + x) * channels, (y * width + x) * channels + 3)];
    for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) {
      assert.deepEqual(px(x, y), [0x29, 0x13, 0x3f], `corner ${x},${y}`);
    }
    let white = 0; // her face is the drawing's creamy paper, the sticker's edge pure white
    let red = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [r, g, b] = px(x, y);
        if (r > 200 && g > 200 && b > 200) white += 1;
        if (r > 170 && g < 90 && b < 90) red += 1;
      }
    }
    assert.ok(white > 0.25 * width * height, `her white face and the sticker: ${white} px`);
    assert.ok(red > 0.02 * width * height, `her red bow: ${red} px`);
  });
}

test('the logo picture to draw the icons from is kept with the script', () => {
  const { width, height } = decodePng(read('scripts/logo-source.png'));
  assert.ok(width >= 512 && height >= 400, `${width}x${height}`);
});
