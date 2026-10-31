// The saved data (spec §4.5): its shape, repairing a damaged file, merging in
// what's in OneDrive, and saving shortly after each change.
import { COLORS } from './colors.js';
import { lastMilestone } from './eggs.js';
import { DIARY_KINDS } from './habits.js';
import { CATEGORIES, OCCASIONS, STYLES, TEMPERATURES, WARMTHS } from './rules.js';
import { SETTINGS } from './settings.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isDate = (v) => typeof v === 'string' && DATE.test(v);
const oneOf = (list, value, fallback) => (list.includes(value) ? value : fallback);

export function emptyData() {
  return {
    version: 1,
    items: {},
    pairScores: {},
    outfitPenalties: {},
    diary: [],
    // How many times she tapped Wore this, and the last milestone celebrated (eggs.js).
    stats: { worn: 0, celebrated: 0 },
    // name: what she calls the app; null shows the default name.
    settings: { occasion: 'everyday', temperature: 'mild', name: null },
    // Pieces she might buy (shop check), oldest first. Their photos are in OneDrive's Wishlist folder.
    wishlist: [],
  };
}

function numbersOnly(raw) {
  const out = {};
  if (!isObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) if (Number.isFinite(value)) out[key] = value;
  return out;
}

// Her name for the app, tidied up; null when there is none.
export function tidyName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().slice(0, 40).trim();
  return name || null;
}

// The longest note she can write on a piece.
export const NOTE_MAX = 100;

// Her note on a piece ("needs ironing"), tidied up; null when there is none.
export function tidyNote(raw) {
  if (typeof raw !== 'string') return null;
  const note = raw.trim().slice(0, NOTE_MAX).trim();
  return note || null;
}

// Drops the oldest lines beyond her latest diaryMax 👍 and 👎 and latest woreMax Wore this.
// Changes `diary` in place.
export function trimDiary(diary) {
  const isWore = (line) => line.kind === 'wore';
  const wore = diary.filter(isWore).length;
  const extra = { wore: wore - SETTINGS.habits.woreMax, other: diary.length - wore - SETTINGS.habits.diaryMax };
  for (let i = 0; i < diary.length && (extra.wore > 0 || extra.other > 0);) {
    const group = isWore(diary[i]) ? 'wore' : 'other';
    if (extra[group] > 0) {
      diary.splice(i, 1);
      extra[group] -= 1;
    } else {
      i += 1;
    }
  }
  return diary;
}

// Keeps the diary lines that make sense, newest last (see trimDiary).
function diaryLines(raw) {
  if (!Array.isArray(raw)) return [];
  return trimDiary(raw
    .filter((line) => isObject(line) && isDate(line.date) && DIARY_KINDS.includes(line.kind)
      && OCCASIONS.includes(line.occasion) && Array.isArray(line.ids) && line.ids.length > 0
      && line.ids.every((id) => typeof id === 'string'))
    .map(({ date, kind, occasion, ids }) => ({ date, kind, occasion, ids: [...ids] })));
}

// Keeps the wishlist items that make sense: an id and every label (spec
// 2026-10-31-shop-check-wishlist-design.md, §4).
function wishlistItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((w) => isObject(w) && typeof w.id === 'string' && w.id !== '' && CATEGORIES.includes(w.category)
      && COLORS.includes(w.color) && WARMTHS.includes(w.warmth) && STYLES.includes(w.style))
    .map((w) => ({
      id: w.id,
      fileName: typeof w.fileName === 'string' ? w.fileName : '',
      category: w.category,
      color: w.color,
      warmth: w.warmth,
      style: w.style,
      addedAt: isDate(w.addedAt) ? w.addedAt : '2000-01-01',
    }));
}

// Her Wore this count from the diary, for data saved before the app counted them. Milestones
// already passed count as celebrated, so updating the app doesn't throw a surprise party.
export function statsFromDiary(diary) {
  const worn = diary.filter((line) => line.kind === 'wore').length;
  return { worn, celebrated: lastMilestone(worn) };
}

const isCount = (v) => Number.isInteger(v) && v >= 0;

function readRaw(text) {
  if (text == null) return null;
  try {
    const raw = JSON.parse(text);
    return isObject(raw) && raw.version === 1 ? raw : null;
  } catch {
    return null;
  }
}

// False when parseData would throw the file away: not JSON, or not a version this app knows.
export function isReadable(text) {
  return readRaw(text) !== null;
}

// Reads data.json. Anything unreadable becomes empty data; bad fields are repaired
// one by one, so a damaged piece just shows up as unlabeled again.
export function parseData(text) {
  const raw = readRaw(text);
  if (!raw) return emptyData();

  const data = emptyData();
  if (isObject(raw.items)) {
    for (const [id, item] of Object.entries(raw.items)) {
      if (!isObject(item) || !CATEGORIES.includes(item.category)) continue;
      data.items[id] = {
        category: item.category,
        fileName: typeof item.fileName === 'string' ? item.fileName : '',
        color: oneOf(COLORS, item.color, null),
        warmth: oneOf(WARMTHS, item.warmth, null),
        style: oneOf(STYLES, item.style, null),
        addedAt: isDate(item.addedAt) ? item.addedAt : '2000-01-01',
        lastWorn: isDate(item.lastWorn) ? item.lastWorn : null,
        wearCount: Number.isInteger(item.wearCount) && item.wearCount >= 0 ? item.wearCount : 0,
      };
      // Only pieces with a note have one.
      const note = tidyNote(item.note);
      if (note) data.items[id].note = note;
    }
  }
  data.pairScores = numbersOnly(raw.pairScores);
  data.outfitPenalties = numbersOnly(raw.outfitPenalties);
  data.diary = diaryLines(raw.diary);
  data.wishlist = wishlistItems(raw.wishlist);
  const stats = isObject(raw.stats) ? raw.stats : {};
  data.stats = isCount(stats.worn) && isCount(stats.celebrated)
    ? { worn: stats.worn, celebrated: stats.celebrated }
    : statsFromDiary(data.diary);
  const settings = isObject(raw.settings) ? raw.settings : {};
  data.settings = {
    occasion: oneOf(OCCASIONS, settings.occasion, data.settings.occasion),
    temperature: oneOf(TEMPERATURES, settings.temperature, data.settings.temperature),
    name: tidyName(settings.name),
  };
  return data;
}

// Brings `data` in line with the photos found in OneDrive (spec §4.3).
// A new photo becomes an unlabeled piece.
export function addPiece(data, { id, category, fileName }, today) {
  data.items[id] = { category, fileName, color: null, warmth: null, style: null, addedAt: today, lastWorn: null, wearCount: 0 };
}

// Pieces whose photos are gone, with the pair scores and outfit penalties they were part of.
// Diary lines stay: learning skips pieces that no longer exist.
export function removePieces(data, ids) {
  const gone = new Set(ids);
  for (const id of gone) delete data.items[id];
  for (const scores of [data.pairScores, data.outfitPenalties]) {
    for (const key of Object.keys(scores)) {
      if (key.split('|').some((id) => gone.has(id))) delete scores[key];
    }
  }
}

export function mergeListing(data, listing, today) {
  const newIds = [];
  let changed = false;
  const listed = new Set();

  for (const entry of listing) {
    const { id, category, fileName } = entry;
    listed.add(id);
    const item = data.items[id];
    if (!item) {
      addPiece(data, entry, today);
      newIds.push(id);
      changed = true;
    } else if (item.category !== category || item.fileName !== fileName) {
      item.category = category;
      item.fileName = fileName;
      changed = true;
    }
  }

  const gone = Object.keys(data.items).filter((id) => !listed.has(id));
  if (gone.length) {
    changed = true;
    removePieces(data, gone);
  }
  return { newIds, changed };
}

// Drops wishlist items whose photo is no longer in OneDrive's Wishlist folder. True if any went.
export function mergeWishlist(data, listing) {
  const listed = new Set(listing.map((entry) => entry.id));
  const before = data.wishlist.length;
  data.wishlist = data.wishlist.filter((w) => listed.has(w.id));
  return data.wishlist.length !== before;
}

export function addToWishlist(data, { id, fileName }, { category, color, warmth, style }, today) {
  data.wishlist.push({ id, fileName, category, color, warmth, style, addedAt: today });
}

export function updateWishlistItem(data, id, { category, color, warmth, style }) {
  const item = data.wishlist.find((w) => w.id === id);
  if (item) Object.assign(item, { category, color, warmth, style });
}

export function removeFromWishlist(data, id) {
  data.wishlist = data.wishlist.filter((w) => w.id !== id);
}

// I bought it: the wishlist item becomes a labeled piece. Its photo is now in a Wardrobe folder,
// named `fileName`.
export function wishlistToPiece(data, id, fileName, today) {
  const item = data.wishlist.find((w) => w.id === id);
  if (!item) return;
  const { category, color, warmth, style } = item;
  data.items[id] = { category, fileName, color, warmth, style, addedAt: today, lastWorn: null, wearCount: 0 };
  removeFromWishlist(data, id);
}

const isLabeled = (item) => Boolean(item.color && item.warmth && item.style);

export function allItems(data) {
  return Object.entries(data.items).map(([id, item]) => ({ id, ...item }));
}

export function labeledItems(data) {
  return allItems(data).filter(isLabeled);
}

export function unlabeledIds(data) {
  return allItems(data)
    .filter((item) => !isLabeled(item))
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.fileName.localeCompare(b.fileName))
    .map((item) => item.id);
}

// Saves `delayMs` after the last change. A failed save stays pending and is
// retried on the next change or flush.
export function createSaver(write, { delayMs = SETTINGS.saveDelayMs, onStatus = () => {} } = {}) {
  let latest = null;
  let dirty = false;
  let timer = null;
  let inFlight = Promise.resolve();

  async function save() {
    clearTimeout(timer);
    timer = null;
    await inFlight;
    if (!dirty) return;
    const text = JSON.stringify(latest);
    dirty = false;
    onStatus('saving');
    inFlight = write(text).then(
      () => onStatus('saved'),
      () => {
        dirty = true;
        onStatus('error');
      },
    );
    await inFlight;
  }

  return {
    schedule(data) {
      latest = data;
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(save, delayMs);
    },
    flush: save,
  };
}
