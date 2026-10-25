import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayISO, daysBetween } from '../js/dates.js';

test('todayISO uses the local calendar date, even late in the evening', () => {
  assert.equal(todayISO(new Date(2026, 9, 25, 23, 30)), '2026-10-25');
  assert.equal(todayISO(new Date(2026, 0, 5, 0, 5)), '2026-01-05');
});

test('daysBetween counts calendar days across a daylight-saving change', () => {
  assert.equal(daysBetween('2026-10-31', '2026-11-02'), 2);
  assert.equal(daysBetween('2026-10-25', '2026-10-25'), 0);
  assert.equal(daysBetween('2026-10-25', '2026-10-20'), -5);
});
