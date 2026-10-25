// The deck of outfit cards on the home screen (spec §2): one card at a time, swiped to the
// next or previous one, with more cards added before she reaches the end. Changes `deck` in place.

export function createDeck(cards) {
  return { cards, index: 0 };
}

export function currentCard(deck) {
  return deck.cards[deck.index] ?? null;
}

// The outfits in the deck, so new cards can be different ones.
export function shownKeys(deck) {
  return deck.cards.filter((card) => card.outfit).map((card) => card.outfit.key);
}

// `step` is 1 for the next card, -1 for the previous one. False when there is none.
export function move(deck, step) {
  const to = deck.index + step;
  if (to < 0 || to >= deck.cards.length) return false;
  deck.index = to;
  return true;
}

// Keeps at least `ahead` cards after the current one (they show behind it, and the next swipe
// always has a card), adding the cards `more()` returns.
export function fillAhead(deck, ahead, more) {
  if (deck.cards.length - deck.index - 1 >= ahead) return;
  deck.cards.push(...more());
}
