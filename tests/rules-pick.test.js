import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreOutfit, pickOutfits } from '../js/rules.js';
import { COLORS } from '../js/colors.js';
import { learnHabits } from '../js/habits.js';
import { SETTINGS } from '../js/settings.js';
import { makeItem as m, outfitOf, blankData } from './helpers.js';

const today = '2026-10-25';
const zero = () => 0;
const base = (opts = {}) => outfitOf(m('t', 'tops', { color: 'red', ...opts }), m('p', 'pants', { color: 'green', ...opts }), m('s', 'shoes', { color: 'black', ...opts }));
const withTop = (topOpts) => outfitOf(m('t', 'tops', { color: 'red', ...topOpts }), m('p', 'pants', { color: 'green' }), m('s', 'shoes', { color: 'black' }));
const score = (o, data = blankData(), extra = {}) => scoreOutfit(o, data, { today, boostForgotten: false, rng: zero, ...extra });
const pick = (items, extra = {}) => pickOutfits(items, blankData(), { occasion: 'everyday', temperature: 'mild', today, rng: zero, ...extra });

test('color score adds up every pair', () => {
  assert.equal(score(base()), 5); // red–green +1, red–black +2, green–black +2
});

test('taste adds pair scores and the outfit penalty', () => {
  const data = blankData();
  data.pairScores['p|t'] = 2;
  data.outfitPenalties['p|s|t'] = -5;
  assert.equal(score(base(), data), 2);
});

test('a piece worn in the last 3 days loses 3 points', () => {
  assert.equal(score(withTop({ lastWorn: '2026-10-23' })), 2);
  assert.equal(score(withTop({ lastWorn: '2026-10-22' })), 5);
});

test('boosting forgotten pieces adds 4 per forgotten piece', () => {
  assert.equal(score(base(), blankData(), { boostForgotten: true }), 17);
  assert.equal(score(withTop({ lastWorn: '2026-10-15' }), blankData(), { boostForgotten: true }), 13);
});

test('randomness adds rng() × 1.5', () => {
  assert.equal(score(base(), blankData(), { rng: () => 0.5 }), 5.75);
});

// Her habits, as learnHabits() returns them: scores from -1 to +1.
const habitsOf = ({ colorPairs = {}, colors = {}, shape = {}, dressedUp = {} }) => ({ choices: 10, colorPairs, colors, shape, dressedUp });

test('habits add points for color pairs, colors, shape and how dressed-up', () => {
  const habits = habitsOf({
    colorPairs: { 'green|red': 1, 'black|green': 0.5 }, // average over 3 pairs 0.5, × 2
    colors: { red: 1, green: 0.5 }, // average over 3 pieces 0.5, × 1
    shape: { everyday: { pants: 0.5 } }, // × 2
    dressedUp: { everyday: { casual: 1 } }, // average over the top and pants 1, × 1
  });
  assert.equal(score(base(), blankData(), { habits, occasion: 'everyday' }), 5 + 1 + 0.5 + 1 + 1);
});

test('habits for another occasion add nothing', () => {
  const habits = habitsOf({ shape: { work: { pants: 1 } }, dressedUp: { work: { casual: 1 } } });
  assert.equal(score(base(), blankData(), { habits, occasion: 'everyday' }), 5);
});

test('an outfit worn yesterday still steps aside, even when it fits all her habits', () => {
  const yesterday = { lastWorn: '2026-10-24' };
  const favorite = [m('t1', 'tops', { color: 'pink', ...yesterday }), m('p1', 'pants', { color: 'black', ...yesterday }), m('s1', 'shoes', { color: 'white', ...yesterday })];
  const fresh = [m('t2', 'tops', { color: 'grey', style: 'smart' }), m('p2', 'pants', { color: 'navy', style: 'smart' }), m('s2', 'shoes', { color: 'beige', style: 'smart' })];
  const habits = habitsOf({
    colorPairs: { 'black|pink': 1, 'pink|white': 1, 'black|white': 1 },
    colors: { pink: 1, black: 1, white: 1 },
    shape: { everyday: { pants: 1 } },
    dressedUp: { everyday: { casual: 1, smart: -1 } },
  });
  const [best] = pick([...favorite, ...fresh], { habits, count: 1, forgottenCards: 0 }).outfits;
  assert.equal(best.key, 'p2|s2|t2');
});

test('pickOutfits uses her habits', () => {
  const items = [m('t1', 'tops', { color: 'red' }), m('t2', 'tops', { color: 'blue' }), m('p', 'pants'), m('s', 'shoes')];
  assert.equal(pick(items, { count: 1 }).outfits[0].key, 'p|s|t1');
  assert.equal(pick(items, { count: 1, habits: habitsOf({ colors: { blue: 1 } }) }).outfits[0].key, 'p|s|t2');
});

test('picks 3 outfits that share no piece', () => {
  const items = ['a', 'b', 'c', 'd'].flatMap((x) => [m(`t${x}`, 'tops'), m(`p${x}`, 'pants'), m(`s${x}`, 'shoes')]);
  const ids = pick(items).outfits.flatMap((o) => o.items.map((i) => i.id));
  assert.equal(ids.length, 9);
  assert.equal(new Set(ids).size, 9);
});

// Worn 5 days ago: neither just worn nor forgotten.
const lately = { lastWorn: '2026-10-20' };
const latelyWardrobe = () => ['a', 'b', 'c', 'd'].flatMap((x) => [m(`t${x}`, 'tops', lately), m(`p${x}`, 'pants', lately), m(`s${x}`, 'shoes', lately)]);

test('one of the three outfits has a forgotten piece, shown last and marked', () => {
  const items = [...latelyWardrobe(), m('old', 'tops', { lastWorn: '2026-08-01' })];
  const { outfits } = pick(items);
  assert.equal(outfits.length, 3);
  assert.ok(outfits[2].forgotten);
  assert.ok(outfits[2].items.some((i) => i.id === 'old'));
  assert.ok(!outfits[0].forgotten && !outfits[1].forgotten);
});

test('the forgotten outfit is the best one that has a forgotten piece', () => {
  // The forgotten red top clashes with the green pants; with the black pants it doesn't.
  const items = [m('t', 'tops', lately), m('pg', 'pants', { ...lately, color: 'green' }), m('pb', 'pants', lately),
    m('s', 'shoes', lately), m('red', 'tops', { color: 'red', lastWorn: null })];
  const [only] = pick(items, { count: 1 }).outfits;
  assert.equal(only.key, 'pb|red|s');
});

test('with nothing forgotten, three ordinary outfits and no note', () => {
  const r = pick(latelyWardrobe());
  assert.equal(r.outfits.length, 3);
  assert.ok(r.outfits.every((o) => !o.forgotten));
  assert.deepEqual(r.notes, []);
});

test('forgottenCards: 0 leaves the forgotten pieces to chance', () => {
  const items = [m('t', 'tops', lately), m('old', 'tops', { lastWorn: '2026-08-01', color: 'red' }), m('p', 'pants', { ...lately, color: 'green' }), m('s', 'shoes', lately)];
  const [only] = pick(items, { count: 1, forgottenCards: 0 }).outfits;
  assert.equal(only.key, 'p|s|t');
  assert.ok(!only.forgotten);
});

test('exclude skips shown outfits, but shows them again when nothing else exists', () => {
  const items = [m('t1', 'tops'), m('t2', 'tops'), m('p', 'pants'), m('s', 'shoes')];
  assert.deepEqual(pick(items, { exclude: ['p|s|t1'], count: 1 }).outfits.map((o) => o.key), ['p|s|t2']);
  assert.equal(pick(items, { exclude: ['p|s|t1', 'p|s|t2'], count: 1 }).outfits.length, 1);
});

test('avoidItemIds keeps those pieces out', () => {
  const items = [m('t1', 'tops'), m('t2', 'tops'), m('p', 'pants'), m('s', 'shoes')];
  assert.deepEqual(pick(items, { avoidItemIds: ['t1'] }).outfits.map((o) => o.key), ['p|s|t2']);
});

test('returns fewer than 3 outfits when that is all there is', () => {
  assert.equal(pick([m('t', 'tops'), m('p', 'pants'), m('s', 'shoes')]).outfits.length, 1);
});

// OneDrive item ids are long (e.g. '01BYE5RZ6QN3ZWBTUFOFD3GSPGOHDJD36K'), which matters for key building.
const oneDriveId = (n) => `01BYE5RZ${String(n).padStart(4, '0')}N3ZWBTUFOFD3GSPGOHDJD3`;

// 94 pieces, with hoodies and sweatshirts that can go over any of the 25 tops.
function bigWardrobe({ withWearDates = false } = {}) {
  const counts = { tops: 25, hoodies: 6, sweatshirts: 4, pants: 6, jeans: 5, shorts: 4, skirts: 8, dresses: 10, shoes: 15, jackets: 6, coats: 5 };
  let n = 0;
  return Object.entries(counts).flatMap(([cat, count]) => Array.from({ length: count }, () => {
    n += 1;
    const lastWorn = withWearDates ? `2026-10-${String(1 + (n % 24)).padStart(2, '0')}` : null;
    const warmth = cat === 'jackets' || cat === 'coats' ? 'light' : 'medium';
    return m(oneDriveId(n), cat, { color: COLORS[n % COLORS.length], warmth, lastWorn });
  }));
}

// Phones are 2–4× slower than a desktop, so 250 ms here keeps a tap under about a second there.
function assertFast(items, extra, data = blankData()) {
  const start = performance.now();
  const r = pickOutfits(items, data, { occasion: 'everyday', temperature: 'mild', today, rng: zero, ...extra });
  const took = performance.now() - start;
  assert.ok(took < 250, `took ${took} ms`);
  assert.equal(r.outfits.length, 3);
}

test('a big wardrobe picks in under 250 ms, with a forgotten-piece outfit', () => {
  assertFast(bigWardrobe());
});

test('a big wardrobe with wear history picks in under 250 ms', () => {
  const items = bigWardrobe({ withWearDates: true });
  assertFast(items);
});

test('a big wardrobe with likes and dislikes picks in under 250 ms', () => {
  const items = bigWardrobe({ withWearDates: true });
  const data = blankData();
  for (let i = 0; i < 40; i++) data.pairScores[`${items[i].id}|${items[i + 30].id}`] = 1;
  for (let i = 0; i < 10; i++) data.outfitPenalties[[items[i].id, items[i + 30].id, items[i + 60].id].sort().join('|')] = -5;
  assertFast(items, {}, data);
});

test('a big wardrobe with a full diary picks in under 250 ms', () => {
  const items = bigWardrobe({ withWearDates: true });
  const data = blankData();
  for (const item of items) data.items[item.id] = item;
  const kinds = ['wore', 'like', 'dislike'];
  for (let i = 0; i < SETTINGS.habits.diaryMax; i++) {
    data.diary.push({
      date: `2026-${String(1 + (i % 10)).padStart(2, '0')}-15`,
      kind: kinds[i % 3],
      occasion: 'everyday',
      ids: [items[i % 30].id, items[30 + (i % 15)].id, items[55 + (i % 15)].id],
    });
  }
  const habits = learnHabits(data, today);
  assert.ok(Object.keys(habits.colorPairs).length > 10);
  assertFast(items, { habits }, data);
});

test('pickOutfits ranks outfits the same way scoreOutfit scores them', () => {
  const items = [m('t1', 'tops', { color: 'red' }), m('t2', 'tops', { color: 'white' }), m('p', 'pants', { color: 'green' }), m('s', 'shoes', { color: 'black' })];
  const data = blankData();
  data.outfitPenalties['p|s|t2'] = -5;
  // Without the penalty the white top wins (6 points to 5); with it, the red top does.
  assert.equal(pick(items, { count: 1 }).outfits[0].key, 'p|s|t2');
  const [best] = pickOutfits(items, data, { occasion: 'everyday', temperature: 'mild', today, rng: zero, count: 1 }).outfits;
  assert.equal(best.key, 'p|s|t1');
  assert.ok(score(best, data) > score(outfitOf(items[1], items[2], items[3]), data));
});

test('more pieces do not score higher just for having more pairs', () => {
  const three = outfitOf(m('t', 'tops'), m('p', 'pants'), m('s', 'shoes'));
  const five = outfitOf(m('t', 'tops'), m('h', 'hoodies'), m('p', 'pants'), m('s', 'shoes'), m('j', 'jackets'));
  const dress = outfitOf(m('d', 'dresses'), m('s', 'shoes'));
  assert.equal(score(three), 6); // 3 neutral pairs × 2
  assert.equal(score(five), 6); // 10 neutral pairs, counted as 3
  assert.equal(score(dress), 6); // 1 neutral pair, counted as 3
});

test('the forgotten-piece bonus counts as if the outfit had 3 pieces', () => {
  const five = outfitOf(m('t', 'tops'), m('h', 'hoodies'), m('p', 'pants'), m('s', 'shoes'), m('j', 'jackets'));
  assert.equal(score(five, blankData(), { boostForgotten: true }), 6 + 12); // 5 forgotten pieces × 4, counted as 3
});
