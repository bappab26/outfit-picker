import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SORTS, findPieces } from '../js/find.js';
import { makeItem as m } from './helpers.js';

const piece = (id, category, extra = {}) => ({ id, ...m(id, category, extra), ...extra });

// In the Wardrobe screen's order (by folder), as allItems() gives them.
const pieces = [
  piece('t1', 'tops', { color: 'black', style: 'smart', warmth: 'light', wearCount: 5, lastWorn: '2026-10-20', addedAt: '2026-10-01', note: 'needs ironing' }),
  piece('t2', 'tops', { color: 'pink', style: 'casual', wearCount: 0, addedAt: '2026-10-28' }),
  piece('j1', 'jeans', { color: 'denim', style: 'casual', wearCount: 5, lastWorn: '2026-10-29', addedAt: '2026-10-05' }),
  piece('s1', 'shoes', { color: 'black', style: 'casual', warmth: 'warm', wearCount: 2, lastWorn: '2026-10-10', addedAt: '2026-10-28', note: 'a bit tight' }),
  piece('d1', 'dresses', { color: null, warmth: null, style: null, wearCount: 0, addedAt: '2026-09-15' }),
];
const ids = (list) => list.map((p) => p.id);

test('the four ways to sort', () => {
  assert.deepEqual(SORTS, ['folder', 'worn', 'never', 'newest']);
});

test('by folder keeps the wardrobe order', () => {
  assert.deepEqual(ids(findPieces(pieces)), ['t1', 't2', 'j1', 's1', 'd1']);
});

test('most worn first, the one worn last first on a tie', () => {
  assert.deepEqual(ids(findPieces(pieces, { sort: 'worn' })), ['j1', 't1', 's1', 't2', 'd1']);
});

test('never worn shows only pieces never worn, the ones waiting longest first', () => {
  assert.deepEqual(ids(findPieces(pieces, { sort: 'never' })), ['d1', 't2']);
});

test('newest first, by the day they were added', () => {
  assert.deepEqual(ids(findPieces(pieces, { sort: 'newest' })), ['t2', 's1', 'j1', 't1', 'd1']);
});

test('search finds pieces by color, type, folder, warmth, style or note, in any case', () => {
  assert.deepEqual(ids(findPieces(pieces, { query: 'black' })), ['t1', 's1']);
  assert.deepEqual(ids(findPieces(pieces, { query: 'JEANS' })), ['j1']);
  assert.deepEqual(ids(findPieces(pieces, { query: 'dress' })), ['d1'], 'part of a word');
  assert.deepEqual(ids(findPieces(pieces, { query: 'warm' })), ['s1']);
  assert.deepEqual(ids(findPieces(pieces, { query: 'smart' })), ['t1']);
  assert.deepEqual(ids(findPieces(pieces, { query: 'tight' })), ['s1']);
});

test('every word of the search must match the same piece', () => {
  assert.deepEqual(ids(findPieces(pieces, { query: '  black   shoes ' })), ['s1']);
  assert.deepEqual(ids(findPieces(pieces, { query: 'pink jeans' })), []);
  assert.deepEqual(ids(findPieces(pieces, { query: '   ' })), ids(pieces), 'spaces only: everything');
});

test('search and sort work together', () => {
  assert.deepEqual(ids(findPieces(pieces, { query: 'casual', sort: 'worn' })), ['j1', 's1', 't2']);
});
