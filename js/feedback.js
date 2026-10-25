// 👍, 👎 and "Wore this" (spec §3.4, taste score; §3.6, the diary). Each changes `data` in place.
// `when` is { today, occasion }: the day and the occasion she chose the outfit for.
import { outfitKey, pairKeys } from './keys.js';
import { SETTINGS } from './settings.js';

function addToPairs(data, outfit, points) {
  for (const key of pairKeys(outfit.items.map((i) => i.id))) {
    data.pairScores[key] = (data.pairScores[key] ?? 0) + points;
  }
}

// One line per tap, newest last, for learning her habits (habits.js).
function addToDiary(data, kind, outfit, { today, occasion }) {
  data.diary.push({ date: today, kind, occasion, ids: outfit.items.map((i) => i.id) });
  const extra = data.diary.length - SETTINGS.habits.diaryMax;
  if (extra > 0) data.diary.splice(0, extra);
}

export function like(data, outfit, when) {
  addToPairs(data, outfit, SETTINGS.taste.like);
  addToDiary(data, 'like', outfit, when);
}

export function dislike(data, outfit, when) {
  addToPairs(data, outfit, SETTINGS.taste.dislike);
  const key = outfitKey(outfit.items.map((i) => i.id));
  data.outfitPenalties[key] = (data.outfitPenalties[key] ?? 0) + SETTINGS.taste.dislikeOutfit;
  addToDiary(data, 'dislike', outfit, when);
}

export function woreThis(data, outfit, when) {
  for (const { id } of outfit.items) {
    const item = data.items[id];
    if (!item) continue;
    item.lastWorn = when.today;
    item.wearCount += 1;
  }
  addToPairs(data, outfit, SETTINGS.taste.wore);
  addToDiary(data, 'wore', outfit, when);
}
