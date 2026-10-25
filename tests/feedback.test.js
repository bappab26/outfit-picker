import { test } from 'node:test';
import assert from 'node:assert/strict';
import { like, dislike, woreThis } from '../js/feedback.js';
import { makeItem as m, outfitOf, blankData } from './helpers.js';

const setup = () => {
  const items = [m('t', 'tops'), m('p', 'pants'), m('s', 'shoes')];
  const data = blankData();
  for (const { id, ...rest } of items) data.items[id] = rest;
  return { data, outfit: outfitOf(...items) };
};

test('like adds 1 to each pair', () => {
  const { data, outfit } = setup();
  like(data, outfit);
  assert.deepEqual(data.pairScores, { 'p|t': 1, 's|t': 1, 'p|s': 1 });
});

test('dislike lowers the pairs and penalizes the exact outfit, adding up', () => {
  const { data, outfit } = setup();
  dislike(data, outfit);
  dislike(data, outfit);
  assert.equal(data.pairScores['p|t'], -2);
  assert.equal(data.outfitPenalties['p|s|t'], -10);
});

test('wore this records the date, counts the wear and adds 0.5 per pair', () => {
  const { data, outfit } = setup();
  data.pairScores['p|t'] = 1;
  woreThis(data, outfit, '2026-10-25');
  assert.equal(data.items.t.lastWorn, '2026-10-25');
  assert.equal(data.items.t.wearCount, 1);
  assert.equal(data.pairScores['p|t'], 1.5);
  assert.equal(data.pairScores['p|s'], 0.5);
});
