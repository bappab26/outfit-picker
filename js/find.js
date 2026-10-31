// Search and sort on the Wardrobe screen (spec §2, Wardrobe screen).
import { folderOf } from './config.js';
import { STYLE_LABELS, WARMTH_LABELS, colorLabel } from './ui/labels.js';

// 'folder' keeps the Wardrobe screen's order; 'never' shows only pieces never worn.
export const SORTS = ['folder', 'worn', 'never', 'newest'];

// Everything a search can find a piece by, in lowercase.
function searchText(piece) {
  return [
    folderOf(piece.category), piece.category,
    piece.color && colorLabel(piece.color), WARMTH_LABELS[piece.warmth], STYLE_LABELS[piece.style],
    piece.note,
  ].filter(Boolean).join(' ').toLowerCase();
}

const ORDER = {
  folder: () => 0,
  worn: (a, b) => b.wearCount - a.wearCount || (b.lastWorn ?? '').localeCompare(a.lastWorn ?? ''),
  never: (a, b) => a.addedAt.localeCompare(b.addedAt), // waiting longest first
  newest: (a, b) => b.addedAt.localeCompare(a.addedAt),
};

// The pieces (from allItems) whose text holds every word of `query`, sorted by `sort`.
// Sorting is stable, so ties keep the Wardrobe screen's order.
export function findPieces(items, { query = '', sort = 'folder' } = {}) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items
    .filter((piece) => sort !== 'never' || piece.wearCount === 0)
    .filter((piece) => {
      const text = searchText(piece);
      return words.every((word) => text.includes(word));
    })
    .sort(ORDER[sort] ?? ORDER.folder);
}
