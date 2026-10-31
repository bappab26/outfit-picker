// Her wardrobe in numbers, for the stats screen (spec §2, Wardrobe stats).
import { OCCASIONS } from './rules.js';

// How many of her most-worn pieces the screen shows.
const MOST_WORN = 3;

// { pieces, worn, thisMonth, neverWorn } for the number tiles, then lists, most first:
// mostWorn [{ id, count }] (on a tie, the one worn last first), colors [{ color, count }]
// (pieces of each color; unlabeled pieces have none) and occasions [{ occasion, count }]
// (her Wore this per occasion, from the diary).
export function wardrobeStats(data, today) {
  const items = Object.entries(data.items);
  const wore = (data.diary ?? []).filter((line) => line.kind === 'wore');

  const mostWorn = items
    .filter(([, item]) => item.wearCount > 0)
    .sort(([, a], [, b]) => b.wearCount - a.wearCount || (b.lastWorn ?? '').localeCompare(a.lastWorn ?? ''))
    .slice(0, MOST_WORN)
    .map(([id, item]) => ({ id, count: item.wearCount }));

  const byColor = {};
  for (const [, item] of items) if (item.color) byColor[item.color] = (byColor[item.color] ?? 0) + 1;
  const colors = Object.entries(byColor)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([color, count]) => ({ color, count }));

  const occasions = OCCASIONS
    .map((occasion) => ({ occasion, count: wore.filter((line) => line.occasion === occasion).length }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count); // a stable sort: ties keep the OCCASIONS order

  return {
    pieces: items.length,
    worn: data.stats?.worn ?? 0,
    thisMonth: wore.filter((line) => line.date.startsWith(`${today.slice(0, 7)}-`)).length,
    neverWorn: items.filter(([, item]) => item.wearCount === 0).length,
    mostWorn,
    colors,
    occasions,
  };
}
