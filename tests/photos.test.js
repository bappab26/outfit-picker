import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitSize, photoFileName } from '../js/photos.js';

test('fitSize shrinks the longest side to 1600 pixels and keeps the shape', () => {
  assert.deepEqual(fitSize(4032, 3024), { width: 1600, height: 1200 });
  assert.deepEqual(fitSize(3024, 4032), { width: 1200, height: 1600 });
  assert.deepEqual(fitSize(1000, 333), { width: 1000, height: 333 }); // never enlarged
});

test('photoFileName is the local date and time, so names sort and rarely clash', () => {
  assert.equal(photoFileName(new Date(2026, 9, 25, 9, 5, 7), 2), 'photo-2026-10-25-090507-2.jpg');
});
