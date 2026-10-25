import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learnHabits, styleSummary } from '../js/habits.js';
import { makeItem as m, blankData } from './helpers.js';

const today = '2026-10-25';
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

function dataWith(items, diary) {
  const data = blankData();
  for (const { id, ...rest } of items) data.items[id] = rest;
  data.diary = diary;
  return data;
}

const choice = (kind, ids, { date = today, occasion = 'everyday' } = {}) => ({ date, kind, occasion, ids });

const pinkTop = m('t', 'tops', { color: 'pink' });
const blackPants = m('p', 'pants', { color: 'black' });
const whiteShoes = m('s', 'shoes', { color: 'white' });
const outfit = ['t', 'p', 's'];

test('no diary means no habits', () => {
  const habits = learnHabits(dataWith([pinkTop, blackPants, whiteShoes], []), today);
  assert.equal(habits.choices, 0);
  assert.deepEqual(habits.colorPairs, {});
  assert.deepEqual(habits.colors, {});
});

test('a yes counts for every color pair and color, starting slowly', () => {
  const habits = learnHabits(dataWith([pinkTop, blackPants, whiteShoes], [choice('wore', outfit)]), today);
  assert.equal(habits.choices, 1);
  close(habits.colorPairs['black|pink'], 1 / 5); // (1 yes − 0 no) / (1 + 4)
  close(habits.colorPairs['black|white'], 1 / 5);
  close(habits.colors.pink, 1 / 5);
});

test('👍 counts as yes and 👎 as no', () => {
  const diary = [choice('like', outfit), choice('like', outfit), choice('dislike', outfit)];
  const habits = learnHabits(dataWith([pinkTop, blackPants, whiteShoes], diary), today);
  close(habits.colors.pink, (2 - 1) / (3 + 4));
});

test('two pieces of the same color make a same-color pair, counted once per outfit', () => {
  const data = dataWith([m('t', 'tops'), m('p', 'pants'), m('s', 'shoes')], [choice('wore', outfit)]);
  const habits = learnHabits(data, today);
  close(habits.colorPairs['black|black'], 1 / 5);
  close(habits.colors.black, 1 / 5);
});

test('a choice from 60 days ago counts half', () => {
  const diary = [choice('wore', outfit, { date: '2026-08-26' })];
  const habits = learnHabits(dataWith([pinkTop, blackPants, whiteShoes], diary), today);
  close(habits.colors.pink, 0.5 / 4.5);
});

test('picking a shape counts for it and against the other shapes at that occasion', () => {
  const dress = m('d', 'dresses');
  const diary = [
    choice('wore', ['d', 's'], { occasion: 'evening' }),
    choice('wore', ['d', 's'], { occasion: 'evening' }),
    choice('like', outfit, { occasion: 'evening' }),
  ];
  const habits = learnHabits(dataWith([dress, pinkTop, blackPants, whiteShoes], diary), today);
  close(habits.shape.evening.dress, (2 - 1) / (3 + 4));
  close(habits.shape.evening.pants, (1 - 2) / (3 + 4));
  close(habits.shape.evening.skirt, (0 - 3) / (3 + 4));
  assert.equal(habits.shape.work, undefined);
});

test('👎 counts only against the shape it shows', () => {
  const habits = learnHabits(dataWith([pinkTop, blackPants, whiteShoes], [choice('dislike', outfit)]), today);
  close(habits.shape.everyday.pants, -1 / 5);
  assert.equal(habits.shape.everyday.dress, undefined);
});

test('dressed-up counts the main pieces against the other style the occasion allows', () => {
  const casualOutfit = [m('t', 'tops', { style: 'casual' }), m('p', 'pants', { style: 'casual' }), m('s', 'shoes', { style: 'smart' })];
  const habits = learnHabits(dataWith(casualOutfit, [choice('wore', outfit)]), today);
  close(habits.dressedUp.everyday.casual, 1 / 5);
  close(habits.dressedUp.everyday.smart, -1 / 5); // the smart shoes don't count: only main pieces do
});

test('a mixed outfit says yes to both styles', () => {
  const mixed = [m('t', 'tops', { style: 'casual' }), m('p', 'pants', { style: 'smart' }), m('s', 'shoes')];
  const habits = learnHabits(dataWith(mixed, [choice('wore', outfit)]), today);
  close(habits.dressedUp.everyday.casual, 1 / 5);
  close(habits.dressedUp.everyday.smart, 1 / 5);
});

test('deleted and unlabeled pieces are skipped; a choice with none left is not counted', () => {
  const unlabeled = { ...m('u', 'tops'), color: null };
  const diary = [choice('wore', ['gone', 'p', 's']), choice('wore', ['gone-too']), choice('wore', ['u'])];
  const habits = learnHabits(dataWith([unlabeled, blackPants, whiteShoes], diary), today);
  assert.equal(habits.choices, 1);
  close(habits.colorPairs['black|white'], 1 / 5);
  assert.equal(habits.colors.pink, undefined);
});

test('the style summary waits for 5 choices', () => {
  const four = Array.from({ length: 4 }, () => choice('wore', outfit));
  assert.equal(styleSummary(learnHabits(dataWith([pinkTop, blackPants, whiteShoes], four), today)), null);
  const five = [...four, choice('wore', outfit)];
  assert.notEqual(styleSummary(learnHabits(dataWith([pinkTop, blackPants, whiteShoes], five), today)), null);
});

test('the style summary lists the clear habits, strongest first', () => {
  const items = [
    pinkTop, blackPants, whiteShoes,
    m('h', 'shoes', { color: 'black', style: 'dressy' }), m('d', 'dresses', { color: 'red', style: 'dressy' }),
    m('c', 'tops', { color: 'green', style: 'smart' }), m('n', 'pants', { color: 'navy', style: 'smart' }),
  ];
  const diary = [
    ...Array.from({ length: 6 }, () => choice('wore', outfit)),
    ...Array.from({ length: 2 }, () => choice('wore', ['t', 'p', 'h'])),
    ...Array.from({ length: 4 }, () => choice('wore', ['d', 'h'], { occasion: 'evening' })),
    choice('dislike', ['c', 'n', 's']),
  ];
  const summary = styleSummary(learnHabits(dataWith(items, diary), today));
  // black+pink 8 yes beats black+white and pink+white (6 yes each, ties go alphabetically);
  // black+black is left out: two pieces of one color aren't a combination to show.
  assert.deepEqual(summary.together, [['black', 'pink'], ['black', 'white']]);
  // black 12 yes, pink 8 yes; white has a 👎 and green only a 👎.
  assert.deepEqual(summary.colors, ['black', 'pink']);
  assert.deepEqual(summary.shapes, { everyday: 'pants', evening: 'dress' });
  assert.deepEqual(summary.dressedUp, { everyday: 'casual', evening: 'dressy' });
});

test('the style summary leaves out weak habits', () => {
  const dress = m('d', 'dresses', { color: 'red' });
  const diary = [
    ...Array.from({ length: 3 }, () => choice('wore', outfit)),
    ...Array.from({ length: 2 }, () => choice('wore', ['d', 's'])),
  ];
  const summary = styleSummary(learnHabits(dataWith([dress, pinkTop, blackPants, whiteShoes], diary), today));
  // Pants 3 to dress 2: (3 − 2) / (5 + 4) is too weak to say "mostly pants".
  assert.deepEqual(summary.shapes, {});
});
