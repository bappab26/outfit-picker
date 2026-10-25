import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swipeResult } from '../js/ui/swipe.js';

const WIDTH = 340; // a card on a phone

test('a long drag to the left is the next outfit, to the right the previous one', () => {
  assert.equal(swipeResult(-120, 5, 600, WIDTH), 'next');
  assert.equal(swipeResult(120, -5, 600, WIDTH), 'previous');
});

test('a short, slow drag puts the card back', () => {
  assert.equal(swipeResult(-40, 0, 600, WIDTH), 'stay');
});

test('a quick flick counts even when it is short', () => {
  assert.equal(swipeResult(-60, 0, 60, WIDTH), 'next');
});

test('a quick twitch under 50 pixels is not a flick', () => {
  assert.equal(swipeResult(-40, 0, 20, WIDTH), 'stay');
});

test('a mostly up-and-down drag is a scroll, not a swipe', () => {
  assert.equal(swipeResult(-90, -200, 300, WIDTH), 'stay');
});
