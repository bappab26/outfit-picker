import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS } from '../js/settings.js';
import { emptyData, parseData, isReadable, mergeListing, labeledItems, unlabeledIds, createSaver } from '../js/store.js';

const entry = (id, category = 'tops', fileName = `${id}.jpg`) => ({ id, category, fileName, thumbUrl: null });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('emptyData has the spec shape and defaults', () => {
  assert.deepEqual(emptyData(), {
    version: 1, items: {}, pairScores: {}, outfitPenalties: {}, diary: [],
    settings: { occasion: 'everyday', temperature: 'mild', somethingDifferent: false },
  });
});

test('parseData falls back to empty data', () => {
  for (const text of [null, 'not json', '[]', '42', JSON.stringify({ version: 2, items: {} })]) {
    assert.deepEqual(parseData(text), emptyData(), String(text));
  }
});

test('isReadable tells a data file this app can read from one it would replace', () => {
  assert.equal(isReadable('{"version":1,"items":{}}'), true);
  for (const text of ['not json', '[]', '{"version":"1"}', '{"version":2}', '{"version":1,}']) {
    assert.equal(isReadable(text), false, text);
  }
});

test('parseData repairs bad fields instead of crashing', () => {
  const data = parseData(JSON.stringify({
    version: 1,
    items: {
      a: { category: 'tops', fileName: 'a.jpg', color: 'teal', warmth: 'hot', style: 'casual', addedAt: '2026-10-01', lastWorn: 'yesterday', wearCount: 'x' },
      b: { category: 'hats', fileName: 'b.jpg' },
      c: 'not an object',
    },
    pairScores: { 'a|b': 'lots', 'a|c': 2 },
    settings: { occasion: 'party', temperature: 'cold' },
  }));
  assert.deepEqual(data.items.a, { category: 'tops', fileName: 'a.jpg', color: null, warmth: null, style: 'casual', addedAt: '2026-10-01', lastWorn: null, wearCount: 0 });
  assert.equal(data.items.b, undefined);
  assert.equal(data.items.c, undefined);
  assert.deepEqual(data.pairScores, { 'a|c': 2 });
  assert.deepEqual(data.outfitPenalties, {});
  assert.deepEqual(data.settings, { occasion: 'everyday', temperature: 'cold', somethingDifferent: false });
  assert.deepEqual(unlabeledIds(data), ['a']);
});

test('mergeListing adds new photos as unlabeled pieces', () => {
  const data = emptyData();
  assert.deepEqual(mergeListing(data, [entry('a')], '2026-10-25'), { newIds: ['a'], changed: true });
  assert.deepEqual(data.items.a, { category: 'tops', fileName: 'a.jpg', color: null, warmth: null, style: null, addedAt: '2026-10-25', lastWorn: null, wearCount: 0 });
});

test('mergeListing updates a moved photo and keeps its labels', () => {
  const data = emptyData();
  mergeListing(data, [entry('a')], '2026-10-01');
  Object.assign(data.items.a, { color: 'red', warmth: 'light', style: 'casual' });
  mergeListing(data, [entry('a', 'outerwear')], '2026-10-25');
  assert.equal(data.items.a.category, 'outerwear');
  assert.equal(data.items.a.style, 'casual');
});

test('mergeListing removes deleted photos with their scores and penalties', () => {
  const data = emptyData();
  mergeListing(data, [entry('a'), entry('b', 'pants'), entry('c', 'shoes')], '2026-10-01');
  data.pairScores = { 'a|b': 1, 'a|c': 1 };
  data.outfitPenalties = { 'a|b|c': -5 };
  mergeListing(data, [entry('a'), entry('c', 'shoes')], '2026-10-25');
  assert.equal(data.items.b, undefined);
  assert.deepEqual(data.pairScores, { 'a|c': 1 });
  assert.deepEqual(data.outfitPenalties, {});
});

test('mergeListing reports no change when nothing changed', () => {
  const data = emptyData();
  mergeListing(data, [entry('a')], '2026-10-01');
  assert.deepEqual(mergeListing(data, [entry('a')], '2026-10-25'), { newIds: [], changed: false });
});

test('labeledItems returns fully labeled pieces with their id', () => {
  const data = emptyData();
  mergeListing(data, [entry('a'), entry('b')], '2026-10-01');
  Object.assign(data.items.a, { color: 'red', warmth: 'light', style: 'casual' });
  assert.deepEqual(labeledItems(data).map((i) => i.id), ['a']);
  assert.deepEqual(unlabeledIds(data), ['b']);
});

test('unlabeledIds lists oldest first, then by file name', () => {
  const data = emptyData();
  mergeListing(data, [entry('x', 'tops', 'b.jpg'), entry('y', 'tops', 'a.jpg')], '2026-10-02');
  mergeListing(data, [entry('x', 'tops', 'b.jpg'), entry('y', 'tops', 'a.jpg'), entry('z', 'tops', 'c.jpg')], '2026-10-01');
  data.items.z.addedAt = '2026-10-01';
  assert.deepEqual(unlabeledIds(data), ['z', 'y', 'x']);
});

test('the saver groups quick changes into one write', async () => {
  const writes = [];
  const saver = createSaver(async (t) => { writes.push(t); }, { delayMs: 10 });
  saver.schedule({ n: 1 });
  saver.schedule({ n: 2 });
  await wait(40);
  assert.deepEqual(writes, ['{"n":2}']);
});

test('the saver retries after a failed write', async () => {
  const statuses = [];
  let fail = true;
  const saver = createSaver(async () => { if (fail) throw new Error('offline'); }, { delayMs: 10, onStatus: (s) => statuses.push(s) });
  saver.schedule({ n: 1 });
  await wait(40);
  fail = false;
  saver.schedule({ n: 2 });
  await wait(40);
  assert.deepEqual(statuses, ['saving', 'error', 'saving', 'saved']);
});

test('flush writes right away', async () => {
  const writes = [];
  const saver = createSaver(async (t) => { writes.push(t); }, { delayMs: 10000 });
  saver.schedule({ n: 1 });
  await saver.flush();
  assert.deepEqual(writes, ['{"n":1}']);
});

test('parseData keeps the Cozy style and the At home occasion', () => {
  const data = parseData(JSON.stringify({
    version: 1,
    items: { a: { category: 'tops', fileName: 'a.jpg', color: 'grey', warmth: 'warm', style: 'cozy', addedAt: '2026-10-01', lastWorn: null, wearCount: 0 } },
    settings: { occasion: 'home', temperature: 'cold', somethingDifferent: false },
  }));
  assert.equal(data.items.a.style, 'cozy');
  assert.equal(data.settings.occasion, 'home');
});

test('parseData keeps good diary lines and drops damaged ones', () => {
  const good = { date: '2026-10-20', kind: 'wore', occasion: 'work', ids: ['a', 'b'] };
  const data = parseData(JSON.stringify({
    version: 1,
    items: {},
    diary: [
      good,
      { ...good, date: 'yesterday' },
      { ...good, kind: 'loved' },
      { ...good, occasion: 'party' },
      { ...good, ids: [] },
      { ...good, ids: ['a', 3] },
      'not a line',
      { ...good, kind: 'dislike', extra: 'dropped' },
    ],
  }));
  assert.deepEqual(data.diary, [good, { ...good, kind: 'dislike' }]);
  assert.deepEqual(parseData(JSON.stringify({ version: 1, diary: 'lots' })).diary, []);
});

test('parseData keeps only the latest diary lines', () => {
  const max = SETTINGS.habits.diaryMax;
  const diary = Array.from({ length: max + 3 }, (_, i) => ({ date: '2026-10-20', kind: 'like', occasion: 'work', ids: [`p${i}`] }));
  const data = parseData(JSON.stringify({ version: 1, diary }));
  assert.equal(data.diary.length, max);
  assert.deepEqual(data.diary[0].ids, ['p3']);
});
