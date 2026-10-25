// 👍, 👎 and "Wore this" (spec §3.4, taste score). Each changes `data` in place.
import { outfitKey, pairKeys } from './keys.js';
import { SETTINGS } from './settings.js';

function addToPairs(data, outfit, points) {
  for (const key of pairKeys(outfit.items.map((i) => i.id))) {
    data.pairScores[key] = (data.pairScores[key] ?? 0) + points;
  }
}

export function like(data, outfit) {
  addToPairs(data, outfit, SETTINGS.taste.like);
}

export function dislike(data, outfit) {
  addToPairs(data, outfit, SETTINGS.taste.dislike);
  const key = outfitKey(outfit.items.map((i) => i.id));
  data.outfitPenalties[key] = (data.outfitPenalties[key] ?? 0) + SETTINGS.taste.dislikeOutfit;
}

export function woreThis(data, outfit, today) {
  for (const { id } of outfit.items) {
    const item = data.items[id];
    if (!item) continue;
    item.lastWorn = today;
    item.wearCount += 1;
  }
  addToPairs(data, outfit, SETTINGS.taste.wore);
}
