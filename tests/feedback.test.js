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

const copy = (data) => JSON.parse(JSON.stringify(data));

test('undo takes back a 👍', () => {
  const { data, outfit } = setup();
  const before = copy(data);
  const undo = like(data, outfit, when);
  undo();
  assert.deepEqual(data, before);
});

test('undo takes back a 👎', () => {
  const { data, outfit } = setup();
  data.pairScores['p|t'] = 2;
  const before = copy(data);
  const undo = dislike(data, outfit, when);
  undo();
  assert.deepEqual(data, before);
});

test('undo takes back a Wore this, with the earlier last-worn date', () => {
  const { data, outfit } = setup();
  data.items.t.lastWorn = '2026-10-01';
  data.items.t.wearCount = 4;
  const before = copy(data);
  const undo = woreThis(data, outfit, when);
  undo();
  assert.deepEqual(data, before);
});

test('undoing one tap keeps the others', () => {
  const { data, outfit } = setup();
  const undoLike = like(data, outfit, when);
  woreThis(data, outfit, when);
  undoLike();
  assert.equal(data.pairScores['p|t'], 0.5);
  assert.deepEqual(data.diary.map((line) => line.kind), ['wore']);
  assert.equal(data.items.t.wearCount, 1);
});

test('the diary keeps only the latest 👍 and 👎', () => {
  const { data, outfit } = setup();
  const max = SETTINGS.habits.diaryMax;
  data.diary.push({ date: '2026-01-01', kind: 'wore', occasion: 'work', ids: ['worn'] });
  for (let i = 0; i < max; i++) data.diary.push({ date: '2026-01-01', kind: 'dislike', occasion: 'work', ids: [`old${i}`] });
  like(data, outfit, when);
  assert.equal(data.diary.length, max + 1);
  assert.deepEqual(data.diary.at(-1).ids, ['t', 'p', 's']);
  assert.deepEqual(data.diary[0].ids, ['worn'], 'a Wore this is kept longer');
  assert.deepEqual(data.diary[1].ids, ['old1']);
});

test('the diary keeps more Wore this, for "one year ago today"', () => {
  const { data, outfit } = setup();
  const max = SETTINGS.habits.woreMax;
  assert.ok(max > SETTINGS.habits.diaryMax);
  for (let i = 0; i < max; i++) data.diary.push({ date: '2026-01-01', kind: 'wore', occasion: 'work', ids: [`old${i}`] });
  woreThis(data, outfit, when);
  assert.equal(data.diary.length, max);
  assert.deepEqual(data.diary[0].ids, ['old1']);
  assert.deepEqual(data.diary.at(-1).ids, ['t', 'p', 's']);
});

test('Wore this counts toward her total, and Undo takes it back', () => {
  const { data, outfit } = setup();
  data.stats.worn = 9;
  const undo = woreThis(data, outfit, when);
  assert.equal(data.stats.worn, 10);
  like(data, outfit, when);
  assert.equal(data.stats.worn, 10, 'a 👍 is not a wear');
  undo();
  assert.equal(data.stats.worn, 9);
});
