// The outfit calendar (spec §2, Outfit calendar): what she wore on each day, from the diary's
// Wore this lines. Days are 'YYYY-MM-DD' (dates.js) and months 'YYYY-MM'.
import { outfitKey } from './keys.js';

const woreLines = (data) => (data.diary ?? []).filter((line) => line.kind === 'wore');
const inMonth = (date, month) => date.startsWith(`${month}-`);
const pad = (n) => String(n).padStart(2, '0');

// The days in `month` she tapped Wore this, as a Set.
export function wornDays(data, month) {
  return new Set(woreLines(data).map((line) => line.date).filter((date) => inMonth(date, month)));
}

// What she wore on `day`, newest first: [{ occasion, ids }], without the pieces she has deleted
// since (an outfit whose pieces are all gone stays, with no ids). The same outfit twice shows once.
export function outfitsOn(data, day) {
  const seen = new Set();
  const outfits = [];
  for (const line of woreLines(data).reverse()) {
    const key = outfitKey(line.ids);
    if (line.date !== day || seen.has(key)) continue;
    seen.add(key);
    outfits.push({ occasion: line.occasion, ids: line.ids.filter((id) => data.items[id]) });
  }
  return outfits;
}

// Her latest day with a Wore this up to `today`, in `month` when given; null if there is none.
export function lastWornDay(data, today, month = null) {
  let latest = null;
  for (const { date } of woreLines(data)) {
    if (date > today || (month && !inMonth(date, month))) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

// The month of her oldest Wore this, or null.
export function firstMonth(data) {
  const [oldest] = woreLines(data).map((line) => line.date).sort();
  return oldest ? oldest.slice(0, 7) : null;
}

// The month `n` months after `month` (before it when `n` is negative).
export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + m - 1 + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

// The month in rows of 7 days, Monday first; the days before the 1st and after the last are null.
export function monthWeeks(month) {
  const [y, m] = month.split('-').map(Number);
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const before = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // getUTCDay: Sunday is 0
  const days = [...Array(before).fill(null), ...Array.from({ length }, (_, i) => `${month}-${pad(i + 1)}`)];
  while (days.length % 7) days.push(null);
  return Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7));
}
