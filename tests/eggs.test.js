import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EGGS, celebrateMilestone, countTap, eggTheme, isBirthday, isLateNight, isMilestone, isRare,
  lastMilestone, longDate, nudgePiece, oneYearAgo, scramble, secretNote, secretStats, unscramble,
} from '../js/eggs.js';
import { makeItem as m, outfitOf, blankData } from './helpers.js';

const withItems = (...items) => {
  const data = blankData();
  for (const { id, ...rest } of items) data.items[id] = rest;
  return data;
};
const line = (date, kind, ids) => ({ date, kind, occasion: 'everyday', ids });

test('a name with "angel" in it gives the angel look, even in devil mode', () => {
  assert.equal(eggTheme('lil angel wardrobe', false), 'angel');
  assert.equal(eggTheme('My ANGEL closet', true), 'angel');
  assert.equal(eggTheme('lil evil wardrobe', true), 'devil');
  assert.equal(eggTheme('lil evil wardrobe', false), null);
});

test('taps on the version line add up while they come quickly, and start over after a pause', () => {
  let taps = countTap(null, 1000);
  assert.deepEqual(taps, { count: 1, at: 1000 });
  taps = countTap(taps, 1000 + EGGS.tapGapMs);
  assert.equal(taps.count, 2);
  taps = countTap(taps, 1000 + 3 * EGGS.tapGapMs);
  assert.equal(taps.count, 1);
  assert.equal(EGGS.devilTaps, 7);
});

test('about one card in 150 is a rare find', () => {
  assert.equal(EGGS.rareChance, 1 / 150);
  assert.equal(isRare(() => 0.001), true);
  assert.equal(isRare(() => 0.5), false);
});

test('her birthday is April 20, any year', () => {
  assert.equal(isBirthday('2027-04-20'), true);
  assert.equal(isBirthday('2031-04-20'), true);
  assert.equal(isBirthday('2027-04-21'), false);
  assert.equal(isBirthday('2027-02-20'), false);
});

test('late night is from 2 a.m. until 5 a.m.', () => {
  const at = (hour, minute = 0) => new Date(2026, 9, 25, hour, minute);
  assert.equal(isLateNight(at(2)), true);
  assert.equal(isLateNight(at(4, 59)), true);
  assert.equal(isLateNight(at(1, 59)), false);
  assert.equal(isLateNight(at(5)), false);
  assert.equal(isLateNight(at(23)), false);
});

test('one year ago today: the last outfit she wore that day, without pieces deleted since', () => {
  const data = withItems(m('a', 'tops'), m('b', 'pants'), m('c', 'shoes'), m('d', 'dresses'));
  data.diary.push(
    line('2025-10-25', 'wore', ['d', 'c']),
    line('2025-10-25', 'wore', ['a', 'b', 'gone']),
    line('2025-10-25', 'like', ['d']),
    line('2025-10-24', 'wore', ['d']),
  );
  assert.deepEqual(oneYearAgo(data, '2026-10-25'), ['a', 'b']);
});

test('one year ago today: nothing when she wore nothing that day, or every piece is gone', () => {
  const data = withItems(m('a', 'tops'));
  data.diary.push(line('2025-10-24', 'wore', ['a']), line('2025-10-26', 'wore', ['a']), line('2024-10-25', 'wore', ['a']));
  assert.equal(oneYearAgo(data, '2026-10-25'), null);
  data.diary.push(line('2025-10-25', 'wore', ['gone']));
  assert.equal(oneYearAgo(data, '2026-10-25'), null);
});

test('the 👎 nudge asks about a piece in 5 turned-down outfits that was never liked or worn', () => {
  const t = m('t', 'tops');
  const p = m('p', 'pants');
  const s = m('s', 'shoes', { wearCount: 2 });
  const data = withItems(t, p, s);
  const outfit = outfitOf(t, p, s);
  for (let i = 0; i < EGGS.nudgeAfter - 1; i++) data.diary.push(line('2026-10-20', 'dislike', ['t', 'p', 's']));
  assert.equal(EGGS.nudgeAfter, 5);
  assert.equal(nudgePiece(data, outfit, new Set()), null, 'only 4 so far');
  data.diary.push(line('2026-10-21', 'dislike', ['t', 'p', 's']));
  data.diary.push(line('2026-10-21', 'like', ['p']));
  assert.equal(nudgePiece(data, outfit, new Set()), 't', 'p was liked once and s has been worn');
  assert.equal(nudgePiece(data, outfit, new Set(['t'])), null, 'she said Keep it');
});

test('Wore this milestones: the 10th, 50th, 100th, then every 100th', () => {
  for (const n of [10, 50, 100, 200, 300, 1000]) assert.equal(isMilestone(n), true, String(n));
  for (const n of [0, 1, 9, 11, 25, 49, 51, 99, 150, 250]) assert.equal(isMilestone(n), false, String(n));
  assert.deepEqual([0, 9, 10, 49, 50, 99, 100, 250].map(lastMilestone), [0, 0, 10, 10, 50, 50, 100, 200]);
});

test('each milestone is celebrated once, even after Undo and Wore this again', () => {
  const stats = { worn: 9, celebrated: 0 };
  assert.equal(celebrateMilestone(stats), null);
  stats.worn = 10;
  assert.equal(celebrateMilestone(stats), 10);
  assert.equal(stats.celebrated, 10);
  stats.worn = 9; // Undo
  stats.worn = 10; // Wore this again
  assert.equal(celebrateMilestone(stats), null);
  stats.worn = 11;
  assert.equal(celebrateMilestone(stats), null);
});

test('the secret card counts her pieces, wears, most-worn piece, favorite color and first day', () => {
  const data = withItems(
    { ...m('a', 'tops', { color: 'black', wearCount: 3 }), addedAt: '2026-10-25' },
    { ...m('b', 'pants', { color: 'black', wearCount: 2 }), addedAt: '2026-10-20' },
    { ...m('c', 'shoes', { color: 'red', wearCount: 4 }), addedAt: '2000-01-01' }, // day unknown
  );
  data.stats = { worn: 7, celebrated: 0 };
  assert.deepEqual(secretStats(data), {
    pieces: 3, worn: 7, mostWorn: { id: 'c', count: 4 }, favoriteColor: 'black', since: '2026-10-20',
  });
});

test('the secret card leaves out what it cannot know yet', () => {
  const data = withItems({ ...m('a', 'tops'), addedAt: '2000-01-01' });
  assert.deepEqual(secretStats(data), { pieces: 1, worn: 0, mostWorn: null, favoriteColor: null, since: null });
});

test('dates on the secret card are written out', () => {
  assert.equal(longDate('2026-10-25'), 'October 25, 2026');
  assert.equal(longDate('2027-04-01'), 'April 1, 2027');
});

test('the secret note is scrambled in the code and reads back', () => {
  assert.equal(unscramble(scramble('Hi 🖤 é')), 'Hi 🖤 é');
  assert.match(secretNote(), /bap bap/);
  assert.ok(!readFileSync(new URL('../js/eggs.js', import.meta.url), 'utf8').includes(secretNote()));
});
