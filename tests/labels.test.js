import { test } from 'node:test';
import assert from 'node:assert/strict';
import { warmthHint } from '../js/ui/labels.js';
import { CATEGORIES } from '../js/rules.js';

test('every kind of piece has a warmth hint that says what the three mean', () => {
  for (const category of CATEGORIES) {
    assert.match(warmthHint(category), /^Light = thin, Medium = in between, Warm = thick\./, category);
  }
});

test('for tops, the hint says Light and Medium work the same', () => {
  for (const category of ['tops', 'hoodies', 'sweatshirts', 'dresses', 'skirts', 'shorts']) {
    assert.match(warmthHint(category), /Light and Medium work the same/, category);
  }
  assert.match(warmthHint('tops'), /For tops, Light and Medium work the same/);
});

test('pants, shoes, jackets and coats say how warmth changes when they are suggested', () => {
  assert.match(warmthHint('jeans'), /Light ones stay home when it's cold/);
  assert.match(warmthHint('shoes'), /Light ones stay home when it's cold/);
  assert.match(warmthHint('coats'), /mild days/);
  assert.match(warmthHint('shorts'), /never suggested when it's cold/);
});
