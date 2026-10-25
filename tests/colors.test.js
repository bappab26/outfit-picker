import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, SWATCHES, wheelDistance, pairColorPoints, nameColor, detectColor } from '../js/colors.js';

// RGBA pixels (alpha 255) of a w×h image filled with `bg`, with an optional square on top.
function image(w, h, bg, square) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inSquare = square && x >= square.x && x < square.x + square.size && y >= square.y && y < square.y + square.size;
      const [r, g, b] = inSquare ? square.rgb : bg;
      px.set([r, g, b, 255], (y * w + x) * 4);
    }
  }
  return px;
}

test('wheel distance wraps around', () => {
  assert.equal(wheelDistance('red', 'orange'), 1);
  assert.equal(wheelDistance('pink', 'red'), 1);
  assert.equal(wheelDistance('red', 'green'), 3);
  assert.equal(wheelDistance('yellow', 'purple'), 3);
  assert.equal(wheelDistance('red', 'yellow'), 2);
});

test('pair color points follow the spec table', () => {
  assert.equal(pairColorPoints('navy', 'red'), 2);
  assert.equal(pairColorPoints('black', 'white'), 2);
  assert.equal(pairColorPoints('red', 'red'), 1);
  assert.equal(pairColorPoints('red', 'orange'), 1);
  assert.equal(pairColorPoints('orange', 'blue'), 1);
  assert.equal(pairColorPoints('red', 'yellow'), -2);
});

test('nameColor maps sample pixels to color names', () => {
  const cases = [
    [[0, 0, 0], 'black'], [[255, 255, 255], 'white'], [[128, 128, 128], 'grey'],
    [[220, 30, 30], 'red'], [[240, 140, 20], 'orange'], [[240, 220, 40], 'yellow'],
    [[40, 160, 60], 'green'], [[30, 100, 220], 'blue'], [[120, 50, 170], 'purple'],
    [[240, 150, 190], 'pink'], [[20, 30, 80], 'navy'], [[80, 110, 150], 'denim'],
    [[110, 70, 40], 'brown'], [[225, 205, 170], 'beige'],
  ];
  for (const [[r, g, b], name] of cases) assert.equal(nameColor(r, g, b), name, `${r},${g},${b}`);
});

test('detectColor ignores a plain background', () => {
  const px = image(20, 20, [255, 255, 255], { x: 5, y: 5, size: 10, rgb: [220, 30, 30] });
  assert.equal(detectColor(px, 20, 20), 'red');
});

test('detectColor names a single-color image', () => {
  assert.equal(detectColor(image(10, 10, [128, 128, 128]), 10, 10), 'grey');
});

test('every color has a swatch', () => {
  for (const c of COLORS) assert.match(SWATCHES[c], /^#[0-9a-f]{6}$/i);
});
