import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOutfits } from '../js/rules.js';
import { makeItem as m } from './helpers.js';

const keys = (r) => r.outfits.map((o) => o.key).sort();
const ctx = (occasion = 'everyday', temperature = 'mild') => ({ occasion, temperature });

test('builds the three outfit shapes', () => {
  const items = [m('t', 'tops'), m('p', 'pants'), m('k', 'skirts'), m('d', 'dresses'), m('s', 'shoes')];
  assert.deepEqual(keys(buildOutfits(items, ctx())), ['d|s', 'k|s|t', 'p|s|t']);
});

test('outfit pieces follow the card order', () => {
  const r = buildOutfits([m('s', 'shoes'), m('p', 'pants'), m('t', 'tops')], ctx());
  assert.deepEqual(r.outfits[0].items.map((i) => i.category), ['tops', 'pants', 'shoes']);
});

test('work never includes a casual top', () => {
  const items = [m('tc', 'tops', { style: 'casual' }), m('ts', 'tops', { style: 'smart' }),
    m('p', 'pants', { style: 'smart' }), m('s', 'shoes', { style: 'smart' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('work'))), ['p|s|ts']);
});

test('shoes may be one step off the occasion, main pieces may not', () => {
  const items = [m('d', 'dresses', { style: 'dressy' }), m('ds', 'dresses', { style: 'smart' }),
    m('s1', 'shoes', { style: 'smart' }), m('s2', 'shoes', { style: 'casual' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('special'))), ['d|s1']);
});

test('hot removes warm pieces and adds no outerwear', () => {
  const items = [m('t', 'tops', { warmth: 'warm' }), m('t2', 'tops', { warmth: 'light' }), m('p', 'pants'),
    m('s', 'shoes'), m('o', 'outerwear', { warmth: 'light' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('everyday', 'hot'))), ['p|s|t2']);
});

test('cold removes light pants and light shoes but keeps light skirts, dresses and tops', () => {
  const items = [m('t', 'tops', { warmth: 'light' }), m('p', 'pants', { warmth: 'light' }),
    m('k', 'skirts', { warmth: 'light' }), m('d', 'dresses', { warmth: 'light' }),
    m('s', 'shoes', { warmth: 'light' }), m('b', 'shoes', { warmth: 'warm' }), m('o', 'outerwear', { warmth: 'warm' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('everyday', 'cold'))), ['b|d|o', 'b|k|o|t']);
});

test('cold adds medium or warm outerwear to every outfit', () => {
  const items = [m('d', 'dresses'), m('s', 'shoes'), m('ol', 'outerwear', { warmth: 'light' }),
    m('om', 'outerwear', { warmth: 'medium' }), m('ow', 'outerwear', { warmth: 'warm' })];
  assert.deepEqual(keys(buildOutfits(items, ctx('everyday', 'cold'))), ['d|om|s', 'd|ow|s']);
});

test('cold without fitting outerwear shows outfits without it and notes add-coat', () => {
  const r = buildOutfits([m('d', 'dresses'), m('s', 'shoes')], ctx('everyday', 'cold'));
  assert.deepEqual(keys(r), ['d|s']);
  assert.deepEqual(r.notes, ['add-coat']);
});

test('mild builds each outfit with and without light or medium outerwear', () => {
  const items = [m('d', 'dresses'), m('s', 'shoes'), m('ol', 'outerwear', { warmth: 'light' }),
    m('om', 'outerwear', { warmth: 'medium' }), m('ow', 'outerwear', { warmth: 'warm' })];
  assert.deepEqual(keys(buildOutfits(items, ctx())), ['d|ol|s', 'd|om|s', 'd|s']);
});

test('removes outfits with more than two bold colors', () => {
  const items = [m('t', 'tops', { color: 'red' }), m('p', 'pants', { color: 'green' }),
    m('s1', 'shoes', { color: 'blue' }), m('s2', 'shoes', { color: 'black' })];
  assert.deepEqual(keys(buildOutfits(items, ctx())), ['p|s2|t']);
});

test('explains why nothing is possible', () => {
  assert.deepEqual(buildOutfits([], ctx()).notes.sort(), ['add-main', 'add-shoes']);
  assert.deepEqual(buildOutfits([m('s', 'shoes')], ctx()).notes, ['add-main']);
  assert.deepEqual(buildOutfits([m('d', 'dresses'), m('s', 'shoes')], ctx('work')).notes, ['no-match']);
});
