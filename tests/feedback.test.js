import { test } from 'node:test';
import assert from 'node:assert/strict';
import { like, dislike, woreThis } from '../js/feedback.js';
import { SETTINGS } from '../js/settings.js';
import { makeItem as m, outfitOf, blankData } from './helpers.js';

const when = { today: '2026-10-25', occasion: 'work' };

const setup = () => {
  const items = [m('t', 'tops'), m('p', 'pants'), m('s', 'shoes')];
  const data = blankData();
  for (const { id, ...rest } of items) data.items[id] = rest;
  return { data, outfit: outfitOf(...items) };
};

test('like adds 1 to each pair', () => {
  const { data, outfit } = setup();
  like(data, outfit, when);
  assert.deepEqual(data.pairScores, { 'p|t': 1, 's|t': 1, 'p|s': 1 });
});

test('dislike lowers the pairs and penalizes the exact outfit, adding up', () => {
  const { data, outfit } = setup();
  dislike(data, outfit, when);
  dislike(data, outfit, when);
  assert.equal(data.pairScores['p|t'], -2);
  assert.equal(data.outfitPenalties['p|s|t'], -10);
});

test('wore this records the date, counts the wear and adds 0.5 per pair', () => {
  const { data, outfit } = setup();
  data.pairScores['p|t'] = 1;
  woreThis(data, outfit, when);
  assert.equal(data.items.t.lastWorn, '2026-10-25');
  assert.equal(data.items.t.wearCount, 1);
  assert.equal(data.pairScores['p|t'], 1.5);
  assert.equal(data.pairScores['p|s'], 0.5);
});

test('each tap adds a line to the diary', () => {
  const { data, outfit } = setup();
  woreThis(data, outfit, when);
  like(data, outfit, when);
  dislike(data, outfit, { today: '2026-10-26', occasion: 'evening' });
  assert.deepEqual(data.diary, [
    { date: '2026-10-25', kind: 'wore', occasion: 'work', ids: ['t', 'p', 's'] },
    { date: '2026-10-25', kind: 'like', occasion: 'work', ids: ['t', 'p', 's'] },
    { date: '2026-10-26', kind: 'dislike', occasion: 'evening', ids: ['t', 'p', 's'] },
  ]);
});

test('the diary keeps only the latest choices', () => {
  const { data, outfit } = setup();
  const max = SETTINGS.habits.diaryMax;
  for (let i = 0; i < max; i++) data.diary.push({ date: '2026-01-01', kind: 'wore', occasion: 'work', ids: ['old'] });
  like(data, outfit, when);
  assert.equal(data.diary.length, max);
  assert.deepEqual(data.diary.at(-1).ids, ['t', 'p', 's']);
  assert.deepEqual(data.diary[0].ids, ['old']);
});
