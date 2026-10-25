import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOutfits, CATEGORIES } from '../js/rules.js';
import { FOLDERS } from '../js/config.js';
import { makeItem as m } from './helpers.js';

const keys = (r) => r.outfits.map((o) => o.key).sort();
const ctx = (occasion = 'everyday', temperature = 'mild') => ({ occasion, temperature });

test('every OneDrive folder is a piece type the rules know', () => {
  assert.deepEqual(Object.keys(FOLDERS), ['Tops', 'Hoodies', 'Sweatshirts', 'Pants', 'Jeans', 'Shorts', 'Skirts', 'Dresses', 'Shoes', 'Jackets', 'Coats']);
  assert.deepEqual([...Object.values(FOLDERS)].sort(), [...CATEGORIES].sort());
});

test('builds the outfit shapes', () => {
  const items = [m('t', 'tops'), m('p', 'pants'), m('k', 'skirts'), m('d', 'dresses'), m('s', 'shoes')];
  assert.deepEqual(keys(buildOutfits(items, ctx())), ['d|s', 'k|s|t', 'p|s|t']);
});

test('jeans, shorts, pants and skirts are all bottoms', () => {
  const items = [m('t', 'tops'), m('p', 'pants'), m('j', 'jeans'), m('sh', 'shorts'), m('k', 'skirts'), m('s', 'shoes')];
  assert.deepEqual(keys(buildOutfits(items, ctx())), ['j|s|t', 'k|s|t', 'p|s|t', 's|sh|t']);
});

test('a hoodie or sweatshirt is worn alone or over a top', () => {
  const items = [m('t', 'tops'), m('h', 'hoodies'), m('w', 'sweatshirts'), m('p', 'pants'), m('s', 'shoes')];
  assert.deepEqual(keys(buildOutfits(items, ctx())), ['h|p|s', 'h|p|s|t', 'p|s|t', 'p|s|t|w', 'p|s|w']);
});

test('never two hoodies, and no hoodie over a dress', () => {
  const items = [m('h', 'hoodies'), m('w', 'sweatshirts'), m('d', 'dresses'), m('s', 'shoes')];
  assert.deepEqual(keys(buildOutfits(items, ctx())), ['d|s']);
});

test('no hoodie over a top when it is hot', () => {
  const items = [m('t', 'tops', { warmth: 'light' }), m('h', 'hoodies'), m('p', 'pants'), m('s', 'shoes')];
  assert.deepEqual(keys(buildOutfits(items, ctx('everyday', 'hot'))), ['h|p|s', 'p|s|t']);
});

test('outfit pieces follow the card order', () => {
  const r = buildOutfits([m('j', 'jackets'), m('s', 'shoes'), m('p', 'pants'), m('h', 'hoodies'), m('t', 'tops')], ctx());
  const layered = r.outfits.find((o) => o.items.length === 5);
  assert.deepEqual(layered.items.map((i) => i.category), ['tops', 'hoodies', 'pants', 'shoes', 'jackets']);
});

test('work never includes a casual top or hoodie', () => {
  const items = [m('tc', 'tops', { style: 'casual' }), m('ts', 'tops', { style: 'smart' }), m('h', 'hoodies', { style: 'casual' }),
    m('p', 'pants', { style: 'smart' }), m('s', 'shoes', { style: 'smart' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('work'))), ['p|s|ts']);
});

test('shoes may be one step off the occasion, main pieces may not', () => {
  const items = [m('d', 'dresses', { style: 'dressy' }), m('ds', 'dresses', { style: 'smart' }),
    m('s1', 'shoes', { style: 'smart' }), m('s2', 'shoes', { style: 'casual' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('special'))), ['d|s1']);
});

test('hot removes warm pieces and adds no jacket or coat', () => {
  const items = [m('t', 'tops', { warmth: 'warm' }), m('t2', 'tops', { warmth: 'light' }), m('p', 'pants'),
    m('s', 'shoes'), m('j', 'jackets', { warmth: 'light' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('everyday', 'hot'))), ['p|s|t2']);
});

test('cold removes shorts, light pants, light jeans and light shoes but keeps light skirts, dresses and tops', () => {
  const items = [m('t', 'tops', { warmth: 'light' }), m('p', 'pants', { warmth: 'light' }), m('j', 'jeans', { warmth: 'light' }),
    m('sh', 'shorts', { warmth: 'warm' }), m('k', 'skirts', { warmth: 'light' }), m('d', 'dresses', { warmth: 'light' }),
    m('s', 'shoes', { warmth: 'light' }), m('b', 'shoes', { warmth: 'warm' }), m('c', 'coats', { warmth: 'warm' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('everyday', 'cold'))), ['b|c|d', 'b|c|k|t']);
});

test('cold adds a medium or warm jacket or coat to every outfit', () => {
  const items = [m('d', 'dresses'), m('s', 'shoes'), m('jl', 'jackets', { warmth: 'light' }),
    m('jm', 'jackets', { warmth: 'medium' }), m('cw', 'coats', { warmth: 'warm' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('everyday', 'cold'))), ['cw|d|s', 'd|jm|s']);
});

test('cold without a fitting jacket or coat shows outfits without one and notes add-coat', () => {
  const r = buildOutfits([m('d', 'dresses'), m('s', 'shoes')], ctx('everyday', 'cold'));
  assert.deepEqual(keys(r), ['d|s']);
  assert.deepEqual(r.notes, ['add-coat']);
});

test('mild builds each outfit with and without a light or medium jacket or coat', () => {
  const items = [m('d', 'dresses'), m('s', 'shoes'), m('jl', 'jackets', { warmth: 'light' }),
    m('cm', 'coats', { warmth: 'medium' }), m('cw', 'coats', { warmth: 'warm' })];
  assert.deepEqual(keys(buildOutfits(items, ctx())), ['cm|d|s', 'd|jl|s', 'd|s']);
});

test('a hoodie can go under a jacket', () => {
  const items = [m('t', 'tops'), m('h', 'hoodies'), m('p', 'pants'), m('s', 'shoes'), m('j', 'jackets', { warmth: 'light' })];
  assert.ok(keys(buildOutfits(items, ctx())).includes('h|j|p|s|t'));
});

test('removes outfits with more than two bold colors, counting every layer', () => {
  const items = [m('t', 'tops', { color: 'red' }), m('p', 'pants', { color: 'green' }),
    m('s1', 'shoes', { color: 'blue' }), m('s2', 'shoes', { color: 'black' }), m('h', 'hoodies', { color: 'yellow' })];
  assert.deepEqual(keys(buildOutfits(items, ctx())), ['h|p|s2', 'p|s2|t']);
});

test('explains why nothing is possible', () => {
  assert.deepEqual(buildOutfits([], ctx()).notes.sort(), ['add-main', 'add-shoes']);
  assert.deepEqual(buildOutfits([m('s', 'shoes')], ctx()).notes, ['add-main']);
  assert.deepEqual(buildOutfits([m('h', 'hoodies'), m('s', 'shoes')], ctx()).notes, ['add-main']);
  assert.deepEqual(buildOutfits([m('h', 'hoodies'), m('j', 'jeans')], ctx()).notes, ['add-shoes']);
  assert.deepEqual(buildOutfits([m('d', 'dresses'), m('s', 'shoes')], ctx('work')).notes, ['no-match']);
});

test('at home uses cozy and casual pieces', () => {
  const items = [m('tc', 'tops', { style: 'cozy' }), m('ts', 'tops', { style: 'smart' }),
    m('p', 'pants', { style: 'casual' }), m('s', 'shoes', { style: 'cozy' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('home'))), ['p|s|tc']);
});

test('cozy shoes and jackets stay home', () => {
  const items = [m('t', 'tops'), m('p', 'pants'), m('slippers', 'shoes', { style: 'cozy' }), m('s', 'shoes'),
    m('robe', 'jackets', { style: 'cozy', warmth: 'medium' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('everyday'))), ['p|s|t']);
  assert.deepEqual(keys(buildOutfits(items, ctx('home'))), ['p|robe|slippers|t', 'p|robe|s|t', 'p|slippers|t', 'p|s|t']);
});

test('at home a coat is optional even when it is cold', () => {
  const items = [m('t', 'tops', { style: 'cozy' }), m('p', 'pants', { style: 'cozy' }), m('s', 'shoes', { style: 'cozy' })];
  const without = buildOutfits(items, ctx('home', 'cold'));
  assert.deepEqual(keys(without), ['p|s|t']);
  assert.deepEqual(without.notes, []);
  const withCardigan = buildOutfits([...items, m('c', 'jackets', { style: 'cozy', warmth: 'warm' })], ctx('home', 'cold'));
  assert.deepEqual(keys(withCardigan), ['c|p|s|t', 'p|s|t']);
});

// Picking ranks outfits as it builds them, so a big wardrobe stays fast (spec §3.2).
test('with a ranking, only the best tops go under each hoodie', () => {
  const tops = ['t1', 't2', 't3', 't4'].map((id) => m(id, 'tops'));
  const items = [...tops, m('h', 'hoodies'), m('p', 'pants'), m('s', 'shoes')];
  const rank = (o) => (o.items.some((i) => i.id === 't3' || i.id === 't4') ? 1 : 0);
  const layered = keys(buildOutfits(items, ctx(), { rank, underTops: 2 })).filter((k) => k.includes('h|') && k.split('|').length === 4);
  assert.deepEqual(layered, ['h|p|s|t3', 'h|p|s|t4']);
});

test('with a ranking, only the best outfits get a jacket or coat', () => {
  const items = [m('t1', 'tops'), m('t2', 'tops'), m('t3', 'tops'), m('p', 'pants'), m('s', 'shoes'), m('j', 'jackets', { warmth: 'light' })];
  const rank = (o) => (o.items.some((i) => i.id === 't2') ? 1 : 0);
  assert.deepEqual(keys(buildOutfits(items, ctx(), { rank, keep: 1 })), ['j|p|s|t2', 'p|s|t2']);
});
