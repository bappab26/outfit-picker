// 👍, 👎 and "Wore this" (spec §3.4, taste score; §3.6, the diary). Each changes `data` in place
// and returns a function that takes it back again (Undo), leaving any other tap as it was.
// `when` is { today, occasion }: the day and the occasion she chose the outfit for.
import { outfitKey, pairKeys } from './keys.js';
import { SETTINGS } from './settings.js';

// Adds `points` to a score, removing it when it is back to nothing.
function addTo(scores, key, points) {
  const value = (scores[key] ?? 0) + points;
  if (value === 0) delete scores[key];
  else scores[key] = value;
}

function addToPairs(data, outfit, points) {
  for (const key of pairKeys(outfit.items.map((i) => i.id))) addTo(data.pairScores, key, points);
}

// One line per tap, newest last, for learning her habits (habits.js). Returns the line.
function addToDiary(data, kind, outfit, { today, occasion }) {
  const line = { date: today, kind, occasion, ids: outfit.items.map((i) => i.id) };
  data.diary.push(line);
  const extra = data.diary.length - SETTINGS.habits.diaryMax;
  if (extra > 0) data.diary.splice(0, extra);
  return line;
}

function removeFromDiary(data, line) {
  const at = data.diary.indexOf(line);
  if (at >= 0) data.diary.splice(at, 1);
}

export function like(data, outfit, when) {
  addToPairs(data, outfit, SETTINGS.taste.like);
  const line = addToDiary(data, 'like', outfit, when);
  return () => {
    addToPairs(data, outfit, -SETTINGS.taste.like);
    removeFromDiary(data, line);
  };
}

export function dislike(data, outfit, when) {
  addToPairs(data, outfit, SETTINGS.taste.dislike);
  const key = outfitKey(outfit.items.map((i) => i.id));
  addTo(data.outfitPenalties, key, SETTINGS.taste.dislikeOutfit);
  const line = addToDiary(data, 'dislike', outfit, when);
  return () => {
    addToPairs(data, outfit, -SETTINGS.taste.dislike);
    addTo(data.outfitPenalties, key, -SETTINGS.taste.dislikeOutfit);
    removeFromDiary(data, line);
  };
}

export function woreThis(data, outfit, when) {
  const before = new Map();
  for (const { id } of outfit.items) {
    const item = data.items[id];
    if (!item) continue;
    before.set(id, item.lastWorn);
    item.lastWorn = when.today;
    item.wearCount += 1;
  }
  addToPairs(data, outfit, SETTINGS.taste.wore);
  const line = addToDiary(data, 'wore', outfit, when);
  return () => {
    for (const [id, lastWorn] of before) {
      const item = data.items[id];
      if (!item) continue;
      // Only if nothing has changed it since.
      if (item.lastWorn === when.today) item.lastWorn = lastWorn;
      item.wearCount = Math.max(0, item.wearCount - 1);
    }
    addToPairs(data, outfit, -SETTINGS.taste.wore);
    removeFromDiary(data, line);
  };
}
