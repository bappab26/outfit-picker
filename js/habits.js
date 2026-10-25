// Her habits, learned by counting the diary of "Wore this", 👍 and 👎 (spec §3.6).
// Each habit is a score from -1 (she keeps saying no) to +1 (she keeps saying yes).
import { daysBetween } from './dates.js';
import { ALLOWED_STYLES, MAIN_PIECES, SHAPE_OF } from './rules.js';
import { SETTINGS } from './settings.js';

export const DIARY_KINDS = ['wore', 'like', 'dislike'];
const SHAPES = Object.values(SHAPE_OF);

// The same key for two colors in either order; 'black|black' for two black pieces.
export function colorPairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// A positive weight is a yes, a negative one a no.
function count(table, key, weight) {
  const tally = (table[key] ??= { yes: 0, no: 0 });
  if (weight > 0) tally.yes += weight;
  else tally.no -= weight;
}

// Counts the options she chose; on a yes, the options she passed over count as a no.
function countChoice(table, chosen, options, weight) {
  for (const option of options) {
    if (chosen.has(option)) count(table, option, weight);
    else if (weight > 0) count(table, option, -weight);
  }
}

function scores(table) {
  const out = {};
  for (const [key, { yes, no }] of Object.entries(table)) {
    out[key] = (yes - no) / (yes + no + SETTINGS.habits.prior);
  }
  return out;
}

function scoresByOccasion(byOccasion) {
  const out = {};
  for (const [occasion, table] of Object.entries(byOccasion)) out[occasion] = scores(table);
  return out;
}

export function learnHabits(data, today) {
  const colorPairs = {};
  const colors = {};
  const shape = {};
  const dressedUp = {};
  let choices = 0;

  for (const line of data.diary ?? []) {
    // Labels come from the pieces as they are now, so a corrected color counts as corrected.
    const pieces = line.ids.map((id) => data.items[id]).filter((p) => p && p.color && p.style);
    if (!pieces.length) continue;
    choices += 1;
    const age = Math.max(0, daysBetween(line.date, today));
    const weight = (line.kind === 'dislike' ? -1 : 1) * 0.5 ** (age / SETTINGS.habits.halfLifeDays);

    const pairs = new Set();
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) pairs.add(colorPairKey(pieces[i].color, pieces[j].color));
    }
    for (const key of pairs) count(colorPairs, key, weight);
    for (const color of new Set(pieces.map((p) => p.color))) count(colors, color, weight);

    const shapes = new Set(pieces.map((p) => SHAPE_OF[p.category]).filter(Boolean));
    if (shapes.size) countChoice((shape[line.occasion] ??= {}), shapes, SHAPES, weight);

    // Only where the occasion allows two styles, and only the main pieces' styles.
    const allowed = ALLOWED_STYLES[line.occasion];
    const styles = new Set(pieces
      .filter((p) => MAIN_PIECES.includes(p.category) && allowed.includes(p.style))
      .map((p) => p.style));
    if (allowed.length > 1 && styles.size) countChoice((dressedUp[line.occasion] ??= {}), styles, allowed, weight);
  }

  return {
    choices,
    colorPairs: scores(colorPairs),
    colors: scores(colors),
    shape: scoresByOccasion(shape),
    dressedUp: scoresByOccasion(dressedUp),
  };
}

// The clear habits for "Your style so far", strongest first; null until she has made enough choices.
export function styleSummary(habits) {
  const { showAfter, strongAt } = SETTINGS.habits;
  if (habits.choices < showAfter) return null;
  const strongest = (table) => Object.entries(table)
    .filter(([, score]) => score >= strongAt)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([key]) => key);
  const bestByOccasion = (byOccasion) => {
    const out = {};
    for (const [occasion, table] of Object.entries(byOccasion)) {
      const [best] = strongest(table);
      if (best) out[occasion] = best;
    }
    return out;
  };
  return {
    // Two pieces of one color aren't a combination worth showing.
    together: strongest(habits.colorPairs).map((key) => key.split('|')).filter(([a, b]) => a !== b).slice(0, 2),
    colors: strongest(habits.colors).slice(0, 2),
    shapes: bestByOccasion(habits.shape),
    dressedUp: bestByOccasion(habits.dressedUp),
  };
}
