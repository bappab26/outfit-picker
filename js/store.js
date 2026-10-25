// The saved data (spec §4.5): its shape, repairing a damaged file, merging in
// what's in OneDrive, and saving shortly after each change.
import { COLORS } from './colors.js';
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
    settings: { occasion: 'everyday', temperature: 'mild', somethingDifferent: false },
  };
}

function numbersOnly(raw) {
  const out = {};
  if (!isObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) if (Number.isFinite(value)) out[key] = value;
  return out;
}

// Keeps the diary lines that make sense, newest last, at most diaryMax of them.
function diaryLines(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((line) => isObject(line) && isDate(line.date) && DIARY_KINDS.includes(line.kind)
      && OCCASIONS.includes(line.occasion) && Array.isArray(line.ids) && line.ids.length > 0
      && line.ids.every((id) => typeof id === 'string'))
    .map(({ date, kind, occasion, ids }) => ({ date, kind, occasion, ids: [...ids] }))
    .slice(-SETTINGS.habits.diaryMax);
}

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
    }
  }
  data.pairScores = numbersOnly(raw.pairScores);
  data.outfitPenalties = numbersOnly(raw.outfitPenalties);
  data.diary = diaryLines(raw.diary);
  const settings = isObject(raw.settings) ? raw.settings : {};
  data.settings = {
    occasion: oneOf(OCCASIONS, settings.occasion, data.settings.occasion),
    temperature: oneOf(TEMPERATURES, settings.temperature, data.settings.temperature),
    somethingDifferent: typeof settings.somethingDifferent === 'boolean' ? settings.somethingDifferent : false,
  };
  return data;
}

// Brings `data` in line with the photos found in OneDrive (spec §4.3).
export function mergeListing(data, listing, today) {
  const newIds = [];
  let changed = false;
  const listed = new Set();

  for (const { id, category, fileName } of listing) {
    listed.add(id);
    const item = data.items[id];
    if (!item) {
      data.items[id] = { category, fileName, color: null, warmth: null, style: null, addedAt: today, lastWorn: null, wearCount: 0 };
      newIds.push(id);
      changed = true;
    } else if (item.category !== category || item.fileName !== fileName) {
      item.category = category;
      item.fileName = fileName;
      changed = true;
    }
  }

  const gone = new Set(Object.keys(data.items).filter((id) => !listed.has(id)));
  if (gone.size) {
    changed = true;
    for (const id of gone) delete data.items[id];
    for (const scores of [data.pairScores, data.outfitPenalties]) {
      for (const key of Object.keys(scores)) {
        if (key.split('|').some((id) => gone.has(id))) delete scores[key];
      }
    }
  }
  return { newIds, changed };
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
