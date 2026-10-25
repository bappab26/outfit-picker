import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreOutfit, pickOutfits } from '../js/rules.js';
import { COLORS } from '../js/colors.js';
import { makeItem as m, outfitOf, blankData } from './helpers.js';

const today = '2026-10-25';
const zero = () => 0;
const base = (opts = {}) => outfitOf(m('t', 'tops', { color: 'red', ...opts }), m('p', 'pants', { color: 'green', ...opts }), m('s', 'shoes', { color: 'black', ...opts }));
const withTop = (topOpts) => outfitOf(m('t', 'tops', { color: 'red', ...topOpts }), m('p', 'pants', { color: 'green' }), m('s', 'shoes', { color: 'black' }));
const score = (o, data = blankData(), extra = {}) => scoreOutfit(o, data, { today, somethingDifferent: false, rng: zero, ...extra });
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

test('something different adds 4 per forgotten piece', () => {
  assert.equal(score(base(), blankData(), { somethingDifferent: true }), 17);
  assert.equal(score(withTop({ lastWorn: '2026-10-15' }), blankData(), { somethingDifferent: true }), 13);
});

test('randomness adds rng() × 1.5', () => {
  assert.equal(score(base(), blankData(), { rng: () => 0.5 }), 5.75);
});

test('picks 3 outfits that share no piece', () => {
  const items = ['a', 'b', 'c', 'd'].flatMap((x) => [m(`t${x}`, 'tops'), m(`p${x}`, 'pants'), m(`s${x}`, 'shoes')]);
  const ids = pick(items).outfits.flatMap((o) => o.items.map((i) => i.id));
  assert.equal(ids.length, 9);
  assert.equal(new Set(ids).size, 9);
});

test('something different puts a forgotten piece in every outfit', () => {
  const recent = { lastWorn: '2026-10-24' };
  const items = [m('t1', 'tops', recent), m('t2', 'tops'), m('p1', 'pants', recent), m('s1', 'shoes', recent), m('s2', 'shoes', recent)];
  const { outfits } = pick(items, { somethingDifferent: true });
  assert.ok(outfits.length > 0);
  for (const o of outfits) assert.ok(o.items.some((i) => i.lastWorn === null));
});

test('notes all-recent when nothing is forgotten', () => {
  const recent = { lastWorn: '2026-10-24' };
  const r = pick([m('t', 'tops', recent), m('p', 'pants', recent), m('s', 'shoes', recent)], { somethingDifferent: true });
  assert.equal(r.outfits.length, 1);
  assert.deepEqual(r.notes, ['all-recent']);
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

function bigWardrobe({ withWearDates = false } = {}) {
  const counts = { tops: 30, pants: 15, skirts: 10, dresses: 10, shoes: 15, outerwear: 10 };
  let n = 0;
  return Object.entries(counts).flatMap(([cat, count]) => Array.from({ length: count }, () => {
    n += 1;
    const lastWorn = withWearDates ? `2026-10-${String(1 + (n % 24)).padStart(2, '0')}` : null;
    return m(oneDriveId(n), cat, { color: COLORS[n % COLORS.length], warmth: cat === 'outerwear' ? 'light' : 'medium', lastWorn });
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

test('a 90-piece wardrobe picks in under 250 ms', () => {
  assertFast(bigWardrobe());
});

test('a 90-piece wardrobe with wear history picks in under 250 ms, with Something different too', () => {
  const items = bigWardrobe({ withWearDates: true });
  assertFast(items);
  assertFast(items, { somethingDifferent: true });
});

test('a 90-piece wardrobe with likes and dislikes picks in under 250 ms', () => {
  const items = bigWardrobe({ withWearDates: true });
  const data = blankData();
  for (let i = 0; i < 40; i++) data.pairScores[`${items[i].id}|${items[i + 30].id}`] = 1;
  for (let i = 0; i < 10; i++) data.outfitPenalties[[items[i].id, items[i + 30].id, items[i + 60].id].sort().join('|')] = -5;
  assertFast(items, {}, data);
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
