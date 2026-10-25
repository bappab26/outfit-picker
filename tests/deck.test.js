import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeck, currentCard, fillAhead, move, shownKeys } from '../js/deck.js';

const card = (key) => ({ outfit: { key } });
const deckOf = (...keys) => createDeck(keys.map(card));

test('a new deck starts at its first card', () => {
  const deck = deckOf('a', 'b', 'c');
  assert.equal(currentCard(deck).outfit.key, 'a');
  assert.equal(currentCard(createDeck([])), null);
});

test('move goes to the next or previous card, never past either end', () => {
  const deck = deckOf('a', 'b');
  assert.equal(move(deck, -1), false);
  assert.equal(move(deck, 1), true);
  assert.equal(currentCard(deck).outfit.key, 'b');
  assert.equal(move(deck, 1), false);
  assert.equal(move(deck, -1), true);
  assert.equal(deck.index, 0);
});

test('fillAhead adds cards when fewer than wanted are left after the current one', () => {
  const deck = deckOf('a', 'b', 'c');
  let asked = 0;
  const more = () => { asked += 1; return [card('d'), card('e'), card('f')]; };
  fillAhead(deck, 2, more);
  assert.equal(asked, 0); // b and c are still to come
  move(deck, 1);
  fillAhead(deck, 2, more);
  assert.equal(asked, 1);
  assert.deepEqual(deck.cards.map((c) => c.outfit.key), ['a', 'b', 'c', 'd', 'e', 'f']);
});

test('fillAhead copes with nothing more to add', () => {
  const deck = deckOf('a');
  fillAhead(deck, 2, () => []);
  assert.equal(deck.cards.length, 1);
});

test('shownKeys lists the outfits in the deck, skipping a card left empty by 👎', () => {
  const deck = createDeck([card('a'), { outfit: null }, card('c')]);
  assert.deepEqual(shownKeys(deck), ['a', 'c']);
});
