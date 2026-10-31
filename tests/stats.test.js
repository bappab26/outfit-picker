import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wardrobeStats } from '../js/stats.js';
import { makeItem as m, blankData } from './helpers.js';

const withItems = (...items) => {
  const data = blankData();
  for (const { id, ...rest } of items) data.items[id] = rest;
  return data;
};
const line = (date, kind, occasion, ids = ['a']) => ({ date, kind, occasion, ids });

function wardrobe() {
  const data = withItems(
    m('a', 'tops', { color: 'black', wearCount: 12, lastWorn: '2026-10-20' }),
    m('b', 'jeans', { color: 'denim', wearCount: 9, lastWorn: '2026-10-28' }),
    m('c', 'shoes', { color: 'black', wearCount: 9, lastWorn: '2026-10-30' }),
    m('d', 'skirts', { color: 'pink', wearCount: 7, lastWorn: '2026-09-01' }),
    m('e', 'tops', { color: 'white', wearCount: 0 }),
    m('f', 'dresses', { color: null, warmth: null, style: null }),
  );
  data.stats.worn = 18;
  data.diary.push(
    line('2026-09-29', 'wore', 'work'),
    line('2026-10-02', 'like', 'evening'),
    line('2026-10-02', 'wore', 'everyday'),
    line('2026-10-12', 'wore', 'evening'),
    line('2026-10-20', 'wore', 'everyday'),
    line('2026-10-20', 'dislike', 'work'),
  );
  return data;
}

test('the four numbers: pieces, outfits worn, worn this month and never worn', () => {
  const stats = wardrobeStats(wardrobe(), '2026-10-31');
  assert.equal(stats.pieces, 6);
  assert.equal(stats.worn, 18);
  assert.equal(stats.thisMonth, 3, 'Wore this in October; 👍 and 👎 don\'t count');
  assert.equal(stats.neverWorn, 2);
});

test('her most-worn pieces: the top 3, most first, the one worn last first on a tie', () => {
  assert.deepEqual(wardrobeStats(wardrobe(), '2026-10-31').mostWorn, [
    { id: 'a', count: 12 },
    { id: 'c', count: 9 },
    { id: 'b', count: 9 },
  ]);
});

test('her colors: how many pieces of each, most first, without unlabeled pieces', () => {
  assert.deepEqual(wardrobeStats(wardrobe(), '2026-10-31').colors, [
    { color: 'black', count: 2 },
    { color: 'denim', count: 1 },
    { color: 'pink', count: 1 },
    { color: 'white', count: 1 },
  ]);
});

test('what she dresses for: her Wore this per occasion, most first', () => {
  assert.deepEqual(wardrobeStats(wardrobe(), '2026-10-31').occasions, [
    { occasion: 'everyday', count: 2 },
    { occasion: 'work', count: 1 },
    { occasion: 'evening', count: 1 },
  ]);
});

test('an empty wardrobe has nothing to show', () => {
  assert.deepEqual(wardrobeStats(blankData(), '2026-10-31'), {
    pieces: 0, worn: 0, thisMonth: 0, neverWorn: 0, mostWorn: [], colors: [], occasions: [],
  });
});
