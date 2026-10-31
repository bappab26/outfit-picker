import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, firstMonth, lastWornDay, monthWeeks, outfitsOn, wornDays } from '../js/worn.js';
import { dayTitle, monthTitle } from '../js/ui/worn.js';
import { makeItem as m, blankData } from './helpers.js';

const withItems = (...items) => {
  const data = blankData();
  for (const { id, ...rest } of items) data.items[id] = rest;
  return data;
};
const line = (date, kind, ids, occasion = 'everyday') => ({ date, kind, occasion, ids });

// Oldest first, as the app saves them.
function sampleDiary() {
  const data = withItems(m('a', 'tops'), m('b', 'pants'), m('c', 'shoes'), m('d', 'dresses'));
  data.diary.push(
    line('2026-09-28', 'wore', ['d', 'c'], 'evening'),
    line('2026-10-02', 'like', ['a', 'b', 'c']),
    line('2026-10-12', 'wore', ['a', 'b', 'c'], 'work'),
    line('2026-10-12', 'dislike', ['a', 'd']),
    line('2026-10-12', 'wore', ['d', 'c'], 'evening'),
    line('2026-10-20', 'wore', ['a', 'gone', 'c']),
    line('2026-10-21', 'wore', ['gone']),
  );
  return data;
}

test('the days she wore something in a month: only Wore this counts', () => {
  const data = sampleDiary();
  assert.deepEqual([...wornDays(data, '2026-10')].sort(), ['2026-10-12', '2026-10-20', '2026-10-21']);
  assert.deepEqual([...wornDays(data, '2026-09')], ['2026-09-28']);
  assert.equal(wornDays(data, '2026-11').size, 0);
});

test('her outfits on a day, newest first, with the occasion', () => {
  assert.deepEqual(outfitsOn(sampleDiary(), '2026-10-12'), [
    { occasion: 'evening', ids: ['d', 'c'] },
    { occasion: 'work', ids: ['a', 'b', 'c'] },
  ]);
  assert.deepEqual(outfitsOn(sampleDiary(), '2026-10-02'), [], 'a 👍 is not something she wore');
  assert.deepEqual(outfitsOn(sampleDiary(), '2026-10-13'), []);
});

test('pieces she has deleted since are left out of an outfit, which stays even when all are gone', () => {
  assert.deepEqual(outfitsOn(sampleDiary(), '2026-10-20'), [{ occasion: 'everyday', ids: ['a', 'c'] }]);
  assert.deepEqual(outfitsOn(sampleDiary(), '2026-10-21'), [{ occasion: 'everyday', ids: [] }]);
});

test('the same outfit worn twice on one day shows once', () => {
  const data = sampleDiary();
  data.diary.push(line('2026-10-12', 'wore', ['c', 'b', 'a'], 'everyday'));
  assert.deepEqual(outfitsOn(data, '2026-10-12'), [
    { occasion: 'everyday', ids: ['c', 'b', 'a'] },
    { occasion: 'evening', ids: ['d', 'c'] },
  ]);
});

test('the calendar opens on her latest Wore this, and each month on its latest one', () => {
  const data = sampleDiary();
  assert.equal(lastWornDay(data, '2026-10-30'), '2026-10-21');
  assert.equal(lastWornDay(data, '2026-11-02'), '2026-10-21', 'nothing yet in November');
  assert.equal(lastWornDay(data, '2026-10-20'), '2026-10-20', 'never after today');
  assert.equal(lastWornDay(data, '2026-10-30', '2026-09'), '2026-09-28');
  assert.equal(lastWornDay(data, '2026-10-30', '2026-08'), null);
  assert.equal(lastWornDay(blankData(), '2026-10-30'), null);
});

test('the first month she wore something, so the calendar can stop there', () => {
  assert.equal(firstMonth(sampleDiary()), '2026-09');
  const data = blankData();
  data.diary.push(line('2026-10-02', 'like', ['a']));
  assert.equal(firstMonth(data), null);
});

test('months count forward and back across years', () => {
  assert.equal(addMonths('2026-10', 1), '2026-11');
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-10', -14), '2025-08');
});

test('a month is laid out in weeks starting on Monday', () => {
  const october = monthWeeks('2026-10'); // October 1, 2026 is a Thursday
  assert.equal(october.length, 5);
  assert.deepEqual(october[0], [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.deepEqual(october[4], ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
  assert.ok(october.every((week) => week.length === 7));

  const november = monthWeeks('2026-11'); // starts on a Sunday, so it needs 6 rows
  assert.equal(november.length, 6);
  assert.deepEqual(november[0], [null, null, null, null, null, null, '2026-11-01']);
  assert.deepEqual(november[5], ['2026-11-30', null, null, null, null, null, null]);

  assert.equal(monthWeeks('2027-02').length, 4, 'February 2027 starts on a Monday and has 28 days');
  assert.equal(monthWeeks('2028-02').flat().filter(Boolean).at(-1), '2028-02-29', 'leap year');
});

test('day and month titles', () => {
  assert.equal(dayTitle('2026-10-30'), 'Fri, Oct 30');
  assert.equal(dayTitle('2027-02-01'), 'Mon, Feb 1');
  assert.equal(monthTitle('2026-10'), 'October 2026');
});
