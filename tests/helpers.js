import { outfitKey } from '../js/keys.js';

export function makeItem(id, category, { color = 'black', warmth = 'medium', style = 'casual', lastWorn = null, wearCount = 0 } = {}) {
  return { id, category, fileName: `${id}.jpg`, color, warmth, style, addedAt: '2026-10-01', lastWorn, wearCount };
}

export function outfitOf(...items) {
  return { key: outfitKey(items.map((i) => i.id)), items };
}

export function blankData() {
  return { version: 1, items: {}, pairScores: {}, outfitPenalties: {}, settings: {} };
}
