import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLORS } from '../js/colors.js';
import { CATEGORIES, ROLES } from '../js/rules.js';
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
