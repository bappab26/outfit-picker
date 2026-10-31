import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, pairColorPoints } from '../js/colors.js';
import { CATEGORIES, OCCASIONS, ROLES, TEMPERATURES, buildOutfits, withIndexes } from '../js/rules.js';
import { SHOP_ID, readyToCheck, shopCheck, shopVerdict } from '../js/shop.js';
import { makeItem as m, blankData } from './helpers.js';

const today = '2026-10-31';
const options = { today, habits: null };
const labels = (category, color, style = 'casual', warmth = 'medium') => ({ category, color, style, warmth });
const keyOf = (pieces) => pieces.map((p) => p.id).sort().join('|');

// All casual and medium unless a test says otherwise.
const wardrobe = [
  m('t1', 'tops', { color: 'black' }), m('t2', 'tops', { color: 'white' }), m('t3', 'tops', { color: 'pink' }),
  m('h1', 'hoodies', { color: 'grey' }),
  m('j1', 'jeans', { color: 'denim' }), m('j2', 'jeans', { color: 'denim' }),
  m('k1', 'skirts', { color: 'black' }),
  m('s1', 'shoes', { color: 'black' }), m('s2', 'shoes', { color: 'white' }),
  m('d1', 'dresses', { color: 'black' }),
];

test('nothing is checked until the type, color and style are picked', () => {
  assert.equal(readyToCheck({ category: 'tops', color: 'red', style: null }), false);
  assert.equal(readyToCheck({ category: 'tops', color: null, style: 'casual' }), false);
  assert.equal(readyToCheck({ category: null, color: 'red', style: 'casual' }), false);
  assert.equal(readyToCheck({ category: 'tops', color: 'red', style: 'casual', warmth: 'medium' }), true);
});

test('a new top is counted with every bottom and shoes, never with another top', () => {
  const { count, best } = shopCheck(wardrobe, labels('tops', 'red'), blankData(), options);
  assert.ok(count > 0);
  assert.ok(best.length > 0);
  for (const outfit of best) {
    assert.equal(outfit[0].id, SHOP_ID, 'the new piece comes first');
    assert.ok(outfit.slice(1).every((p) => ROLES[p.category] !== 'top'), outfit.map((p) => p.id).join(','));
  }
});

test('the same outfit is counted once, though it fits several occasions and temperatures', () => {
  const two = [m('j1', 'jeans', { color: 'denim' }), m('s1', 'shoes', { color: 'black' })];
  assert.equal(shopCheck(two, labels('tops', 'black'), blankData(), options).count, 1);
});

test('a color that clashes with a piece leaves that outfit out', () => {
  // Red with yellow is an "other" pair (−2 color points); black shoes go with anything.
  const clash = [m('k1', 'skirts', { color: 'yellow' }), m('s1', 'shoes', { color: 'black' })];
  assert.equal(shopCheck(clash, labels('tops', 'red'), blankData(), options).count, 0);
  const fine = [m('k1', 'skirts', { color: 'black' }), m('s1', 'shoes', { color: 'black' })];
  assert.equal(shopCheck(fine, labels('tops', 'red'), blankData(), options).count, 1);
});

test('a new dress goes with shoes, not with tops or bottoms', () => {
  const { count, best } = shopCheck(wardrobe, labels('dresses', 'red'), blankData(), options);
  assert.equal(count, 2, 'one outfit per pair of shoes');
  for (const outfit of best) assert.deepEqual(outfit.map((p) => ROLES[p.category]), ['dress', 'shoes']);
});

test('nothing labeled yet: nothing to count', () => {
  assert.deepEqual(shopCheck([], labels('tops', 'red'), blankData(), options), { count: 0, best: [] });
});

test('the best 3, never the same outfit twice', () => {
  const { count, best } = shopCheck(wardrobe, labels('shoes', 'black'), blankData(), options);
  assert.ok(count > 3);
  assert.equal(best.length, 3);
  assert.equal(new Set(best.map(keyOf)).size, 3);
});

test('the verdict line', () => {
  assert.equal(shopVerdict(10), 'A great match for your wardrobe 🔥');
  assert.equal(shopVerdict(3), 'Goes with a few things');
  assert.equal(shopVerdict(1), 'Only goes with a little');
  assert.equal(shopVerdict(0), "Doesn't go with anything you own yet");
});

test('a check stays quick with 200 pieces', () => {
  const styles = ['casual', 'smart', 'dressy', 'cozy'];
  const warmths = ['light', 'medium', 'warm'];
  const big = Array.from({ length: 200 }, (_, i) => m(`p${i}`, CATEGORIES[i % CATEGORIES.length], {
    color: COLORS[i % COLORS.length], style: styles[i % styles.length], warmth: warmths[i % warmths.length],
  }));
  const start = performance.now();
  const { count } = shopCheck(big, labels('tops', 'black', 'smart'), blankData(), options);
  const ms = performance.now() - start;
  assert.ok(count > 0);
  assert.ok(ms < 2000, `${Math.round(ms)} ms`);
});

// A wardrobe like a real one: mostly tops, shoes and neutral colors, a few of everything else.
// The same `seed` always gives the same wardrobe.
function realisticWardrobe(size, seed) {
  const kinds = [['tops', 25], ['hoodies', 5], ['sweatshirts', 5], ['pants', 8], ['jeans', 8], ['shorts', 4],
    ['skirts', 6], ['dresses', 8], ['shoes', 14], ['jackets', 9], ['coats', 8]].flatMap(([kind, n]) => Array(n).fill(kind));
  const colors = ['black', 'black', 'black', 'white', 'white', 'grey', 'beige', 'navy', 'denim', 'brown', 'pink', 'red', 'blue', 'green'];
  const styles = ['casual', 'casual', 'casual', 'smart', 'smart', 'dressy', 'cozy'];
  const warmths = ['light', 'medium', 'medium', 'warm'];
  let s = seed;
  const pick = (list) => list[Math.floor(((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648) * list.length)];
  return Array.from({ length: size }, (_, i) => m(`p${i}`, pick(kinds), { color: pick(colors), style: pick(styles), warmth: pick(warmths) }));
}

// Every outfit the rules allow with the new piece, built with no cut at all (only for small wardrobes).
function countWithoutCut(items, labels) {
  const piece = { id: SHOP_ID, ...labels, fileName: '', addedAt: today, lastWorn: null, wearCount: 0 };
  const others = items.filter((i) => ROLES[i.category] !== ROLES[piece.category]);
  const keys = new Set();
  for (const occasion of OCCASIONS) {
    for (const temperature of TEMPERATURES) {
      for (const outfit of buildOutfits(withIndexes([...others, piece]), { occasion, temperature }).outfits) {
        const holds = outfit.items.some((p) => p.id === SHOP_ID);
        if (holds && outfit.items.every((p) => p.id === SHOP_ID || pairColorPoints(piece.color, p.color) >= 0)) keys.add(outfit.key);
      }
    }
  }
  return keys.size;
}

test('in a realistic wardrobe, a hoodie, a sweatshirt and a dress each go with outfits', () => {
  const items = realisticWardrobe(150, 7);
  for (const [category, color] of [['hoodies', 'grey'], ['sweatshirts', 'black'], ['dresses', 'black']]) {
    assert.ok(shopCheck(items, labels(category, color), blankData(), options).count > 0, category);
  }
});

test('in a small wardrobe, the count is every outfit the rules allow', () => {
  // No hoodies or sweatshirts: the app always puts only the best 4 tops under one, on purpose.
  const items = realisticWardrobe(40, 11).filter((i) => ROLES[i.category] !== 'layer');
  for (const [category, color] of [['tops', 'black'], ['dresses', 'black'], ['shoes', 'white'], ['skirts', 'beige'], ['coats', 'navy']]) {
    assert.equal(shopCheck(items, labels(category, color), blankData(), options).count, countWithoutCut(items, labels(category, color)), category);
  }
});

test('every type of piece checks quickly in a realistic 200-piece wardrobe', () => {
  const items = realisticWardrobe(200, 3);
  const start = performance.now();
  for (const category of CATEGORIES) shopCheck(items, labels(category, 'black'), blankData(), options);
  const ms = performance.now() - start;
  assert.ok(ms < 2000, `all 11 types: ${Math.round(ms)} ms`);
});
