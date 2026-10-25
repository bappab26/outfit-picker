// The outfit rules (spec §3): build every possible outfit, remove the ones
// that don't fit, then score and pick.
import { isNeutral, pairColorPoints } from './colors.js';
import { daysBetween } from './dates.js';
import { outfitKey } from './keys.js';
import { SETTINGS } from './settings.js';

// Order of pieces on an outfit card.
export const CATEGORIES = ['tops', 'dresses', 'pants', 'skirts', 'shoes', 'outerwear'];
export const OCCASIONS = ['everyday', 'work', 'evening', 'special'];
export const TEMPERATURES = ['cold', 'mild', 'hot'];
export const STYLES = ['casual', 'smart', 'dressy'];
export const WARMTHS = ['light', 'medium', 'warm'];

export const ALLOWED_STYLES = {
  everyday: ['casual', 'smart'],
  work: ['smart'],
  evening: ['smart', 'dressy'],
  special: ['dressy'],
};

// Which outerwear can be added at each temperature.
const OUTERWEAR_WARMTHS = { cold: ['medium', 'warm'], mild: ['light', 'medium'], hot: [] };

// Pieces that must match the occasion exactly; shoes and outerwear may be one step off.
const MAIN_PIECES = ['tops', 'pants', 'skirts', 'dresses'];

export function fitsStyle(item, occasion) {
  const allowed = ALLOWED_STYLES[occasion];
  if (MAIN_PIECES.includes(item.category)) return allowed.includes(item.style);
  const step = STYLES.indexOf(item.style);
  return allowed.some((s) => Math.abs(STYLES.indexOf(s) - step) <= 1);
}

export function fitsTemperature(item, temperature) {
  if (temperature === 'hot') return item.warmth !== 'warm';
  if (temperature === 'cold') {
    // Shorts, thin trousers and sandals stay home; light skirts and dresses
    // are fine with tights, and light tops go under a coat.
    return !((item.category === 'pants' || item.category === 'shoes') && item.warmth === 'light');
  }
  return true;
}

// An outfit whose key (sorted ids) is only built when something asks for it:
// a big wardrobe makes 100,000+ candidates and only a few keys are ever needed.
function makeOutfit(pieces) {
  let key;
  return {
    items: pieces,
    get key() {
      key ??= outfitKey(pieces.map((p) => p.id));
      return key;
    },
  };
}

function boldColors(pieces) {
  const bold = new Set();
  for (const p of pieces) if (!isNeutral(p.color)) bold.add(p.color);
  return bold;
}

// Every outfit that fits the occasion and temperature. `items` must be fully labeled.
export function buildOutfits(items, { occasion, temperature }) {
  const fitting = items.filter((i) => fitsStyle(i, occasion) && fitsTemperature(i, temperature));
  const of = (category) => fitting.filter((i) => i.category === category);
  const tops = of('tops');
  const bottoms = [...of('pants'), ...of('skirts')];
  const dresses = of('dresses');
  const shoes = of('shoes');
  const outerwear = of('outerwear').filter((o) => OUTERWEAR_WARMTHS[temperature].includes(o.warmth));

  const bases = [];
  for (const s of shoes) {
    for (const t of tops) for (const b of bottoms) bases.push([t, b, s]);
    for (const d of dresses) bases.push([d, s]);
  }

  const notes = [];
  let layers;
  if (temperature === 'cold') layers = outerwear.length ? outerwear : [null];
  else if (temperature === 'mild') layers = [null, ...outerwear];
  else layers = [null];

  const outfits = [];
  for (const base of bases) {
    const baseBold = boldColors(base);
    if (baseBold.size > SETTINGS.maxBoldColors) continue;
    for (const layer of layers) {
      if (layer && !isNeutral(layer.color) && !baseBold.has(layer.color) && baseBold.size >= SETTINGS.maxBoldColors) continue;
      outfits.push(makeOutfit(layer ? [...base, layer] : base));
    }
  }

  if (outfits.length) {
    if (temperature === 'cold' && !outerwear.length) notes.push('add-coat');
  } else {
    const has = (category) => items.some((i) => i.category === category);
    if (!has('shoes')) notes.push('add-shoes');
    if (!has('dresses') && !(has('tops') && (has('pants') || has('skirts')))) notes.push('add-main');
    if (!notes.length) notes.push('no-match');
  }
  return { outfits, notes };
}

// Not worn for a long time, or never worn.
export function isForgotten(item, today) {
  return item.lastWorn === null || daysBetween(item.lastWorn, today) >= SETTINGS.forgottenDays;
}

function pieceFreshness(item, today, somethingDifferent) {
  let points = 0;
  if (item.lastWorn && daysBetween(item.lastWorn, today) < SETTINGS.recentDays) points += SETTINGS.recentPenalty;
  if (somethingDifferent && isForgotten(item, today)) points += SETTINGS.forgottenBonus;
  return points;
}

// Spec §3.4: colors and taste per pair, the outfit's own penalty, freshness per piece, a little randomness.
// Works out everything that depends only on pieces once, so scoring each of 100,000+
// candidates is just table lookups. Requires pieces[i].index === i.
function makeScorer(pieces, data, { today, somethingDifferent, rng }) {
  const n = pieces.length;
  const pairs = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = pieces[i];
      const b = pieces[j];
      const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`; // same format as pairKeys()
      const points = pairColorPoints(a.color, b.color) + (data.pairScores[key] ?? 0);
      pairs[i * n + j] = points;
      pairs[j * n + i] = points;
    }
  }
  const fresh = pieces.map((p) => pieceFreshness(p, today, somethingDifferent));
  // Only outfits made entirely of disliked-outfit pieces can have a penalty.
  const penalized = new Set(Object.keys(data.outfitPenalties).flatMap((key) => key.split('|')));

  return (outfit) => {
    const ps = outfit.items;
    let score = 0;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i].index;
      score += fresh[a];
      for (let j = i + 1; j < ps.length; j++) score += pairs[a * n + ps[j].index];
    }
    if (penalized.size && ps.every((p) => penalized.has(p.id))) score += data.outfitPenalties[outfit.key] ?? 0;
    return score + rng() * SETTINGS.randomMax;
  };
}

const withIndexes = (items) => items.map((item, index) => ({ ...item, index }));

export function scoreOutfit(outfit, data, options) {
  const pieces = withIndexes(outfit.items);
  return makeScorer(pieces, data, options)({ key: outfit.key, items: pieces });
}

// The best `count` outfits, sharing no piece. `exclude` holds keys of outfits already
// on screen (Shuffle); they come back only when nothing else is left.
export function pickOutfits(items, data, {
  occasion, temperature, somethingDifferent = false, today, rng = Math.random,
  exclude = [], avoidItemIds = [], count = SETTINGS.suggestions,
}) {
  const pieces = withIndexes(items);
  const built = buildOutfits(pieces, { occasion, temperature });
  const notes = [...built.notes];
  let candidates = built.outfits;

  if (somethingDifferent) {
    const forgotten = new Set(pieces.filter((i) => isForgotten(i, today)).map((i) => i.id));
    const withForgotten = candidates.filter((o) => o.items.some((i) => forgotten.has(i.id)));
    if (withForgotten.length) candidates = withForgotten;
    else if (candidates.length) notes.push('all-recent');
  }
  const avoid = new Set(avoidItemIds);
  if (avoid.size) candidates = candidates.filter((o) => !o.items.some((i) => avoid.has(i.id)));

  const score = makeScorer(pieces, data, { today, somethingDifferent, rng });
  const ranked = candidates
    .map((outfit) => ({ outfit, score: score(outfit) }))
    .sort((a, b) => b.score - a.score);

  const excluded = new Set(exclude);
  const picked = [];
  const used = new Set();
  const take = (allowExcluded) => {
    for (const { outfit } of ranked) {
      if (picked.length >= count) return;
      if (picked.includes(outfit) || (!allowExcluded && excluded.has(outfit.key))) continue;
      if (outfit.items.some((i) => used.has(i.id))) continue;
      picked.push(outfit);
      for (const i of outfit.items) used.add(i.id);
    }
  };
  take(false);
  if (picked.length < count) take(true);
  return { outfits: picked, notes };
}
