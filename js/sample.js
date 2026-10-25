// A built-in wardrobe for trying the app without signing in (spec §2, "Sample mode").
import { SWATCHES } from './colors.js';
import { emptyData, statsFromDiary } from './store.js';

const sampleId = (n) => `sample-${String(n).padStart(2, '0')}`;

const piece = (n, category, fileName, color, warmth, style) => ({
  id: sampleId(n),
  category, fileName, color, warmth, style,
  addedAt: '2026-01-01', lastWorn: null, wearCount: 0,
});

// Chosen so every occasion and temperature has at least 3 outfits that share no piece.
export const SAMPLE_ITEMS = [
  piece(1, 'tops', 'White blouse', 'white', 'light', 'smart'),
  piece(2, 'tops', 'Blue shirt', 'blue', 'light', 'smart'),
  piece(3, 'tops', 'Grey sweater', 'grey', 'warm', 'smart'),
  piece(4, 'tops', 'Beige knit', 'beige', 'medium', 'smart'),
  piece(5, 'tops', 'White tee', 'white', 'light', 'casual'),
  piece(6, 'tops', 'Red tee', 'red', 'light', 'casual'),
  piece(7, 'tops', 'Pink tank top', 'pink', 'light', 'casual'),
  piece(8, 'hoodies', 'Grey hoodie', 'grey', 'warm', 'casual'),
  piece(9, 'pants', 'Black trousers', 'black', 'medium', 'smart'),
  piece(10, 'pants', 'Navy trousers', 'navy', 'medium', 'smart'),
  piece(11, 'jeans', 'Jeans', 'denim', 'medium', 'casual'),
  piece(12, 'shorts', 'Shorts', 'beige', 'light', 'casual'),
  piece(13, 'skirts', 'Grey pencil skirt', 'grey', 'medium', 'smart'),
  piece(14, 'skirts', 'Yellow skirt', 'yellow', 'light', 'casual'),
  piece(15, 'dresses', 'Little black dress', 'black', 'light', 'dressy'),
  piece(16, 'dresses', 'Red dress', 'red', 'medium', 'dressy'),
  piece(17, 'dresses', 'Navy gown', 'navy', 'medium', 'dressy'),
  piece(18, 'dresses', 'Green shirt dress', 'green', 'medium', 'smart'),
  piece(19, 'shoes', 'Black heels', 'black', 'medium', 'dressy'),
  piece(20, 'shoes', 'Brown loafers', 'brown', 'medium', 'smart'),
  piece(21, 'shoes', 'Strappy sandals', 'beige', 'light', 'dressy'),
  piece(22, 'shoes', 'Ankle boots', 'black', 'warm', 'smart'),
  piece(23, 'shoes', 'White sneakers', 'white', 'medium', 'casual'),
  piece(24, 'shoes', 'Flat sandals', 'brown', 'light', 'casual'),
  piece(25, 'coats', 'Wool coat', 'beige', 'warm', 'smart'),
  piece(26, 'jackets', 'Navy blazer', 'navy', 'medium', 'smart'),
  piece(27, 'coats', 'Evening coat', 'black', 'warm', 'dressy'),
  piece(28, 'jackets', 'Denim jacket', 'denim', 'light', 'casual'),
  piece(29, 'coats', 'Puffer jacket', 'grey', 'warm', 'casual'),
  piece(30, 'tops', 'Lounge tee', 'purple', 'light', 'cozy'),
  piece(31, 'pants', 'Sweatpants', 'grey', 'warm', 'cozy'),
  piece(32, 'shoes', 'Slippers', 'beige', 'medium', 'cozy'),
  piece(33, 'sweatshirts', 'Cozy sweatshirt', 'brown', 'medium', 'cozy'),
  piece(34, 'hoodies', 'Black hoodie', 'black', 'warm', 'casual'),
  piece(35, 'sweatshirts', 'Navy sweatshirt', 'navy', 'medium', 'casual'),
  piece(36, 'jeans', 'Black jeans', 'black', 'medium', 'casual'),
  piece(37, 'shorts', 'Denim shorts', 'denim', 'light', 'casual'),
  piece(38, 'jackets', 'Leather jacket', 'black', 'medium', 'smart'),
  piece(39, 'coats', 'Beige trench', 'beige', 'medium', 'smart'),
];

// A made-up diary, oldest first: pink with black, casual pants outfits every day and
// dresses for evenings out, so the learned habits and "Your style so far" show (spec §3.6).
// [days ago, tap, occasion, piece numbers]
const SAMPLE_DIARY = [
  [27, 'wore', 'evening', [16, 21, 27]],
  [24, 'wore', 'everyday', [7, 12, 24]],
  [21, 'wore', 'work', [3, 9, 22]],
  [20, 'wore', 'evening', [17, 21]],
  [18, 'dislike', 'everyday', [2, 10, 20]],
  [16, 'like', 'everyday', [6, 12, 24]],
  [15, 'dislike', 'evening', [1, 9, 20]],
  [14, 'like', 'work', [4, 13, 20]],
  [13, 'wore', 'everyday', [7, 11, 19]],
  [11, 'like', 'evening', [16, 19]],
  [9, 'wore', 'everyday', [5, 11, 23]],
  [7, 'wore', 'work', [1, 13, 22]],
  [6, 'wore', 'everyday', [7, 12, 22]],
  [4, 'wore', 'evening', [15, 19]],
  [3, 'wore', 'everyday', [7, 9, 23]],
  [2, 'wore', 'everyday', [7, 11, 22]],
  [2, 'like', 'everyday', [7, 11, 22]],
];

function daysBefore(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

// The sample wardrobe with a mix of wear history: a third worn in the last two days,
// a third not worn for weeks, a third never worn, so freshness and the forgotten-piece outfit show.
export function sampleData(today) {
  const data = emptyData();
  SAMPLE_ITEMS.forEach(({ id, ...item }, i) => {
    const history = [
      { lastWorn: daysBefore(today, 1 + (i % 2)), wearCount: 5 },
      { lastWorn: daysBefore(today, 45), wearCount: 2 },
      { lastWorn: null, wearCount: 0 },
    ][i % 3];
    data.items[id] = { ...item, ...history };
  });
  data.diary = SAMPLE_DIARY.map(([daysAgo, kind, occasion, pieces]) => (
    { date: daysBefore(today, daysAgo), kind, occasion, ids: pieces.map(sampleId) }));
  data.stats = statsFromDiary(data.diary);
  return data;
}

const SHAPES = {
  tops: '<path d="M60 40 L85 30 Q100 46 115 30 L140 40 L172 72 L150 94 L140 84 L140 172 L60 172 L60 84 L50 94 L28 72 Z"/>',
  hoodies: '<path d="M72 44 Q72 10 100 10 Q128 10 128 44 Z"/><path d="M60 40 L85 32 Q100 48 115 32 L140 40 L176 150 L154 158 L140 100 L140 176 L60 176 L60 100 L46 158 L24 150 Z"/><path d="M84 120 H116 V146 H84 Z" fill="none"/>',
  sweatshirts: '<path d="M60 40 L85 30 Q100 46 115 30 L140 40 L176 150 L154 158 L140 100 L140 176 L60 176 L60 100 L46 158 L24 150 Z"/><path d="M60 164 H140" fill="none"/>',
  pants: '<path d="M62 28 H138 L148 176 H110 L100 82 L90 176 H52 Z"/>',
  jeans: '<path d="M62 28 H138 L148 176 H110 L100 82 L90 176 H52 Z"/><path d="M62 44 H138 M72 44 Q76 64 96 62 M128 44 Q124 64 104 62" fill="none"/>',
  shorts: '<path d="M58 52 H142 L156 134 H110 L100 92 L90 134 H44 Z"/>',
  skirts: '<path d="M72 36 H128 L162 168 H38 Z"/>',
  dresses: '<path d="M80 24 H120 L117 72 L156 176 H44 L83 72 Z"/>',
  shoes: '<path d="M28 124 Q28 94 58 98 L94 104 Q122 84 150 112 L172 132 Q176 152 150 152 H40 Q28 152 28 138 Z"/>',
  jackets: '<path d="M64 30 L86 24 L100 62 L114 24 L136 30 L172 62 L162 150 H38 L28 62 Z"/><path d="M100 62 V150" fill="none"/>',
  coats: '<path d="M64 22 L86 16 L100 56 L114 16 L136 22 L172 56 L166 186 H34 L28 56 Z"/><path d="M100 56 V186" fill="none"/>',
};

// A simple drawing of a piece in its color, as an image address.
export function drawItem(category, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">`
    + `<g fill="${SWATCHES[color] ?? '#cccccc'}" stroke="#9a9a9a" stroke-width="3" stroke-linejoin="round">`
    + `${SHAPES[category] ?? ''}</g></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
