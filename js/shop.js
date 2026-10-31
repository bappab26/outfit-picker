// Shop check (spec 2026-10-31-shop-check-wishlist-design.md, §3): how many outfits a piece she's
// thinking of buying would make with her clothes, and the best of them. Built with the app's
// own rules, so a match is an outfit the app could really suggest.
import { pairColorPoints } from './colors.js';
import { OCCASIONS, ROLES, TEMPERATURES, buildOutfits, makeScorer, withIndexes } from './rules.js';
import { SETTINGS } from './settings.js';

// The id of the piece being checked; no piece in her wardrobe has it.
export const SHOP_ID = 'shop-check';

// How many of the best outfits to show.
const BEST = 3;

// A check needs its type, color and style (warmth starts at Medium).
export function readyToCheck(labels) {
  return Boolean(labels.category && labels.color && labels.style);
}

// { count, best } for a piece with `labels` ({ category, color, warmth, style }) among her
// labeled `items`. `best` holds up to BEST outfits, best first, each with the new piece first.
export function shopCheck(items, labels, data, { today, habits }) {
  const piece = {
    id: SHOP_ID, category: labels.category, fileName: '', color: labels.color, warmth: labels.warmth,
    style: labels.style, addedAt: today, lastWorn: null, wearCount: 0,
  };
  // Every other piece of the same role is left out: an outfit has one of each.
  const role = ROLES[piece.category];
  const others = items.filter((item) => ROLES[item.category] !== role);
  const clashes = (outfit) => outfit.items.some((p) => p.id !== SHOP_ID && pairColorPoints(piece.color, p.color) < 0);

  // Each outfit once, with the best score it got for any occasion and temperature. Only outfits
  // holding the new piece are built (`mustHold`), so the cut for a big wardrobe ranks only those.
  const pieces = withIndexes([...others, piece]);
  const found = new Map();
  for (const occasion of OCCASIONS) {
    const score = makeScorer(pieces, data, { today, rng: () => 0, habits, occasion });
    for (const temperature of TEMPERATURES) {
      for (const outfit of buildOutfits(pieces, { occasion, temperature }, { rank: score, mustHold: SHOP_ID }).outfits) {
        if (clashes(outfit)) continue;
        const points = score(outfit);
        const seen = found.get(outfit.key);
        if (!seen || points > seen.points) found.set(outfit.key, { pieces: outfit.items, points });
      }
    }
  }

  const best = [...found.values()]
    .sort((a, b) => b.points - a.points)
    .slice(0, BEST)
    .map(({ pieces }) => [...pieces.filter((p) => p.id === SHOP_ID), ...pieces.filter((p) => p.id !== SHOP_ID)]);
  return { count: found.size, best };
}

// Checks for one visit to the Shop check screen: each set of labels is worked out once, so
// drawing the screen again (a tap, "Saving…") doesn't redo it. Her wardrobe can't change during
// a visit, except with I bought it, after which the caller starts a new one.
export function createShopChecks(items, data, options) {
  const done = new Map();
  return (labels) => {
    const key = [labels.category, labels.color, labels.warmth, labels.style].join('|');
    if (!done.has(key)) done.set(key, shopCheck(items, labels, data, options));
    return done.get(key);
  };
}

// The line under "Goes with N outfits".
export function shopVerdict(count) {
  const { great, few, little } = SETTINGS.shop;
  if (count >= great) return 'A great match for your wardrobe 🔥';
  if (count >= few) return 'Goes with a few things';
  if (count >= little) return 'Only goes with a little';
  return "Doesn't go with anything you own yet";
}
