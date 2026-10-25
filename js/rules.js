// The outfit rules (spec §3): build every possible outfit, remove the ones
// that don't fit, then score and pick.
import { isNeutral, pairColorPoints } from './colors.js';
import { daysBetween } from './dates.js';
import { outfitKey } from './keys.js';
import { SETTINGS } from './settings.js';

// Order of pieces on an outfit card: what goes on first comes first.
export const CATEGORIES = ['tops', 'hoodies', 'sweatshirts', 'dresses', 'pants', 'jeans', 'shorts', 'skirts', 'shoes', 'jackets', 'coats'];
export const OCCASIONS = ['everyday', 'work', 'evening', 'special', 'home'];
export const TEMPERATURES = ['cold', 'mild', 'hot'];
// From most relaxed to most dressed up; "one step off" counts along this list.
export const STYLES = ['cozy', 'casual', 'smart', 'dressy'];
export const WARMTHS = ['light', 'medium', 'warm'];

export const ALLOWED_STYLES = {
  everyday: ['casual', 'smart'],
  work: ['smart'],
  evening: ['smart', 'dressy'],
  special: ['dressy'],
  home: ['cozy', 'casual'],
};

// What each kind of piece is in an outfit (spec §3.2). A layer (hoodie or sweatshirt) is worn
// on its own as the top or over a top; an outer piece (jacket or coat) goes over everything.
export const ROLES = {
  tops: 'top',
  hoodies: 'layer',
  sweatshirts: 'layer',
  dresses: 'dress',
  pants: 'bottom',
  jeans: 'bottom',
  shorts: 'bottom',
  skirts: 'bottom',
  shoes: 'shoes',
  jackets: 'outer',
  coats: 'outer',
};

// Which jackets and coats can be added at each temperature.
const OUTER_WARMTHS = { cold: ['medium', 'warm'], mild: ['light', 'medium'], hot: [] };

// Pieces that must match the occasion exactly; shoes, jackets and coats may be one step off.
export const MAIN_PIECES = CATEGORIES.filter((c) => ['top', 'layer', 'dress', 'bottom'].includes(ROLES[c]));

// An outfit's shape, for learning her habits (spec §3.6). Jeans count as pants.
export const SHAPE_OF = { dresses: 'dress', skirts: 'skirt', pants: 'pants', jeans: 'pants', shorts: 'shorts' };

// A big wardrobe makes too many outfits to score them all on a phone. So when picking, only
// the best UNDER_TOPS tops go under each hoodie or sweatshirt, and only the best KEEP outfits
// get a jacket or coat (spec §3.2).
const UNDER_TOPS = 4;
const KEEP = 500;

export function fitsStyle(item, occasion) {
  const allowed = ALLOWED_STYLES[occasion];
  if (MAIN_PIECES.includes(item.category)) return allowed.includes(item.style);
  // Slippers and lounge layers stay home.
  if (item.style === 'cozy') return allowed.includes('cozy');
  const step = STYLES.indexOf(item.style);
  return allowed.some((s) => Math.abs(STYLES.indexOf(s) - step) <= 1);
}

export function fitsTemperature(item, temperature) {
  if (temperature === 'hot') return item.warmth !== 'warm';
  if (temperature === 'cold') {
    // Shorts, thin trousers and jeans, and sandals stay home; light skirts and dresses
    // are fine with tights, and light tops go under a coat.
    if (item.category === 'shorts') return false;
    const thin = ['pants', 'jeans', 'shoes'].includes(item.category) && item.warmth === 'light';
    return !thin;
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

// The `count` lists of pieces that `rank` scores highest.
function best(lists, count, rank) {
  if (lists.length <= count) return lists;
  return lists
    .map((pieces) => ({ pieces, score: rank(makeOutfit(pieces)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ pieces }) => pieces);
}

// Every outfit that fits the occasion and temperature. `items` must be fully labeled.
// With `rank` (an outfit's score), a big wardrobe is cut down while building, as above.
export function buildOutfits(items, { occasion, temperature }, { rank = null, underTops = UNDER_TOPS, keep = KEEP } = {}) {
  const fitting = items.filter((i) => fitsStyle(i, occasion) && fitsTemperature(i, temperature));
  const of = (role) => fitting.filter((i) => ROLES[i.category] === role);
  const tops = of('top');
  const layers = of('layer');
  const bottoms = of('bottom');
  const dresses = of('dress');
  const shoes = of('shoes');
  const outers = of('outer').filter((o) => OUTER_WARMTHS[temperature].includes(o.warmth));
  const bestOf = (lists, count) => (rank ? best(lists, count, rank) : lists);

  // A top, a hoodie or sweatshirt on its own, or (unless it's hot) a hoodie or sweatshirt over a top.
  const uppers = [...tops, ...layers].map((p) => [p]);
  if (temperature !== 'hot') {
    for (const layer of layers) uppers.push(...bestOf(tops.map((t) => [t, layer]), underTops));
  }

  let bases = [];
  for (const s of shoes) {
    for (const u of uppers) for (const b of bottoms) bases.push([...u, b, s]);
    for (const d of dresses) bases.push([d, s]);
  }
  bases = bestOf(bases.filter((base) => boldColors(base).size <= SETTINGS.maxBoldColors), keep);

  const coatRequired = needsCoat({ occasion, temperature });
  let extras;
  if (coatRequired) extras = outers.length ? outers : [null];
  else extras = [null, ...outers];

  const outfits = [];
  for (const base of bases) {
    const baseBold = boldColors(base);
    for (const outer of extras) {
      if (outer && !isNeutral(outer.color) && !baseBold.has(outer.color) && baseBold.size >= SETTINGS.maxBoldColors) continue;
      outfits.push(makeOutfit(outer ? [...base, outer] : base));
    }
  }

  return { outfits, notes: outfitNotes(items, { occasion, temperature }, outfits.length > 0) };
}

// At home a coat is never needed; a cardigan is a choice.
function needsCoat({ occasion, temperature }) {
  return temperature === 'cold' && occasion !== 'home';
}

// What to tell her: a coat to add, or why no outfit is possible.
function outfitNotes(items, { occasion, temperature }, hasOutfits) {
  if (hasOutfits) {
    const fittingOuter = items.some((i) => ROLES[i.category] === 'outer' && OUTER_WARMTHS[temperature].includes(i.warmth)
      && fitsStyle(i, occasion) && fitsTemperature(i, temperature));
    return needsCoat({ occasion, temperature }) && !fittingOuter ? ['add-coat'] : [];
  }
  const notes = [];
  const has = (role) => items.some((i) => ROLES[i.category] === role);
  if (!has('shoes')) notes.push('add-shoes');
  if (!has('dress') && !((has('top') || has('layer')) && has('bottom'))) notes.push('add-main');
  if (!notes.length) notes.push('no-match');
  return notes;
}

// Not worn for a long time, or never worn.
export function isForgotten(item, today) {
  return item.lastWorn === null || daysBetween(item.lastWorn, today) >= SETTINGS.forgottenDays;
}

function isRecent(item, today) {
  return Boolean(item.lastWorn) && daysBetween(item.lastWorn, today) < SETTINGS.recentDays;
}

const NO_HABITS = { colorPairs: {}, colors: {}, shape: {}, dressedUp: {} };

// Spec §3.4: colors and taste per pair, the outfit's own penalty, freshness per piece, a little randomness,
// and her habits (§3.6) from learnHabits(). Works out everything that depends only on pieces once,
// so scoring each of 100,000+ candidates is just table lookups. Requires pieces[i].index === i.
function makeScorer(pieces, data, { today, boostForgotten = false, rng, habits = null, occasion }) {
  const points = SETTINGS.habits.points;
  const learned = habits ?? NO_HABITS;
  const n = pieces.length;
  const pairs = new Float64Array(n * n);
  const pairHabits = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = pieces[i];
      const b = pieces[j];
      const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`; // same format as pairKeys()
      const colorKey = a.color < b.color ? `${a.color}|${b.color}` : `${b.color}|${a.color}`; // same as colorPairKey()
      pairs[i * n + j] = pairs[j * n + i] = pairColorPoints(a.color, b.color) + (data.pairScores[key] ?? 0);
      pairHabits[i * n + j] = pairHabits[j * n + i] = learned.colorPairs[colorKey] ?? 0;
    }
  }
  // Every just-worn piece loses points; the forgotten-piece bonus is scaled to 3 pieces like the pairs.
  const recent = pieces.map((p) => (isRecent(p, today) ? SETTINGS.recentPenalty : 0));
  const bonus = pieces.map((p) => (boostForgotten && isForgotten(p, today) ? SETTINGS.forgottenBonus : 0));
  const shapeHabits = learned.shape[occasion] ?? {};
  const styleHabits = learned.dressedUp[occasion] ?? {};
  // Every outfit has exactly one dress or bottom, so shape points add up per piece.
  const shapePoints = pieces.map((p) => points.shape * (shapeHabits[SHAPE_OF[p.category]] ?? 0));
  const colorHabits = pieces.map((p) => learned.colors[p.color] ?? 0);
  const isMain = pieces.map((p) => MAIN_PIECES.includes(p.category));
  const styleHabitsOf = pieces.map((p) => styleHabits[p.style] ?? 0);
  // Only outfits made entirely of disliked-outfit pieces can have a penalty.
  const penalized = new Set(Object.keys(data.outfitPenalties).flatMap((key) => key.split('|')));

  return (outfit) => {
    const ps = outfit.items;
    let score = 0;
    let pairPoints = 0;
    let forgottenPoints = 0;
    // Habits are averaged over pairs and pieces, so an outfit doesn't gain just by having a coat.
    let pairHabit = 0;
    let colorHabit = 0;
    let styleHabit = 0;
    let mains = 0;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i].index;
      score += recent[a] + shapePoints[a];
      forgottenPoints += bonus[a];
      colorHabit += colorHabits[a];
      if (isMain[a]) {
        styleHabit += styleHabitsOf[a];
        mains += 1;
      }
      for (let j = i + 1; j < ps.length; j++) {
        pairPoints += pairs[a * n + ps[j].index];
        pairHabit += pairHabits[a * n + ps[j].index];
      }
    }
    const pairCount = (ps.length * (ps.length - 1)) / 2;
    // Color and taste points count as if the outfit had 3 pairs (top, bottom, shoes), so a hoodie
    // and a jacket don't win just by adding pairs, and a dress with shoes (1 pair) isn't behind.
    score += (pairPoints * 3) / pairCount;
    score += (forgottenPoints * 3) / ps.length;
    score += (points.colorPairs * pairHabit) / pairCount;
    score += (points.colors * colorHabit) / ps.length;
    if (mains) score += (points.dressedUp * styleHabit) / mains;
    if (penalized.size && ps.every((p) => penalized.has(p.id))) score += data.outfitPenalties[outfit.key] ?? 0;
    return score + rng() * SETTINGS.randomMax;
  };
}

const withIndexes = (items) => items.map((item, index) => ({ ...item, index }));

export function scoreOutfit(outfit, data, options) {
  const pieces = withIndexes(outfit.items);
  return makeScorer(pieces, data, options)({ key: outfit.key, items: pieces });
}

// The best `count` outfits, sharing no piece (spec §3.5). Up to `forgottenCards` of them have
// a piece she hasn't worn in a long time: those come last and are marked `forgotten`.
// `exclude` holds keys of outfits already on screen (Shuffle); they come back only when
// nothing else is left. `avoidItemIds` are pieces that can't be used (on the other cards).
export function pickOutfits(items, data, {
  occasion, temperature, today, rng = Math.random, habits = null,
  exclude = [], avoidItemIds = [], count = SETTINGS.suggestions, forgottenCards = 1,
}) {
  const ctx = { occasion, temperature };
  const excluded = new Set(exclude);
  // Pieces on a picked outfit (or on the other cards) can't be used again.
  const used = new Set(avoidItemIds);
  const all = items.filter((i) => !used.has(i.id));

  // The outfits made from the pieces still free, best first, by the score with or
  // without the forgotten-piece bonus.
  const rankFree = (boostForgotten) => {
    const pieces = withIndexes(all.filter((i) => !used.has(i.id)));
    const score = makeScorer(pieces, data, { today, boostForgotten, rng, habits, occasion });
    return buildOutfits(pieces, ctx, { rank: score }).outfits
      .map((outfit) => ({ outfit, score: score(outfit) }))
      .sort((a, b) => b.score - a.score)
      .map(({ outfit }) => outfit);
  };

  // Up to `upTo` outfits that pass `fits`, sharing no piece. Building cuts a big wardrobe down,
  // so when the list runs out of outfits that share no piece, it is built again from what's left.
  const pick = (boostForgotten, upTo, fits) => {
    const picked = [];
    const takeFrom = (ranked, allowExcluded) => {
      let added = false;
      for (const outfit of ranked) {
        if (picked.length >= upTo) break;
        if (!fits(outfit) || (!allowExcluded && excluded.has(outfit.key))) continue;
        if (outfit.items.some((i) => used.has(i.id))) continue;
        picked.push(outfit);
        for (const i of outfit.items) used.add(i.id);
        added = true;
      }
      return added;
    };
    while (picked.length < upTo && takeFrom(rankFree(boostForgotten), false));
    if (picked.length < upTo && excluded.size) takeFrom(rankFree(boostForgotten), true);
    return picked;
  };

  const forgotten = new Set(all.filter((i) => isForgotten(i, today)).map((i) => i.id));
  const forgottenPicks = forgottenCards > 0 && forgotten.size
    ? pick(true, Math.min(forgottenCards, count), (o) => o.items.some((i) => forgotten.has(i.id)))
    : [];
  for (const outfit of forgottenPicks) outfit.forgotten = true;
  const ordinary = pick(false, count - forgottenPicks.length, () => true);
  const outfits = [...ordinary, ...forgottenPicks];
  return { outfits, notes: outfitNotes(all, ctx, outfits.length > 0) };
}
