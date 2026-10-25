import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_ITEMS, sampleData, drawItem } from '../js/sample.js';
import { createSampleSource } from '../js/sources.js';
import { pickOutfits, OCCASIONS, TEMPERATURES, CATEGORIES, STYLES, WARMTHS } from '../js/rules.js';
import { BOLDS, SWATCHES } from '../js/colors.js';
import { labeledItems } from '../js/store.js';

const today = '2026-10-25';
const fakeStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
};

test('sample pieces cover every type, style and warmth', () => {
  assert.ok(SAMPLE_ITEMS.length >= 22 && SAMPLE_ITEMS.length <= 36, `${SAMPLE_ITEMS.length} pieces`);
  assert.equal(new Set(SAMPLE_ITEMS.map((i) => i.id)).size, SAMPLE_ITEMS.length);
  for (const c of CATEGORIES) assert.ok(SAMPLE_ITEMS.some((i) => i.category === c), c);
  for (const s of STYLES) assert.ok(SAMPLE_ITEMS.some((i) => i.style === s), s);
  for (const w of WARMTHS) assert.ok(SAMPLE_ITEMS.some((i) => i.warmth === w), w);
  assert.ok(new Set(SAMPLE_ITEMS.map((i) => i.color).filter((c) => BOLDS.includes(c))).size >= 4);
  assert.equal(labeledItems(sampleData(today)).length, SAMPLE_ITEMS.length);
});

test('every occasion and temperature gets 3 sample outfits', () => {
  const data = sampleData(today);
  for (const occasion of OCCASIONS) {
    for (const temperature of TEMPERATURES) {
      const r = pickOutfits(labeledItems(data), data, { occasion, temperature, today, rng: () => 0 });
      assert.equal(r.outfits.length, 3, `${occasion}/${temperature}`);
      assert.ok(!r.notes.includes('add-coat'), `${occasion}/${temperature}`);
    }
  }
});

test('the sample has recent, long-unworn and never-worn pieces', () => {
  const items = labeledItems(sampleData(today));
  assert.ok(items.some((i) => i.lastWorn === '2026-10-24' || i.lastWorn === '2026-10-23'));
  assert.ok(items.some((i) => i.lastWorn && i.lastWorn <= '2026-09-15'));
  assert.ok(items.some((i) => i.lastWorn === null));
});

test('drawItem returns an SVG in the piece color', () => {
  const url = drawItem('tops', 'navy');
  assert.ok(url.startsWith('data:image/svg+xml,'));
  assert.ok(decodeURIComponent(url).toLowerCase().includes(SWATCHES.navy.toLowerCase()));
});

test('the sample source loads the sample first, then what was saved', async () => {
  const storage = fakeStorage();
  const first = await createSampleSource({ storage, today }).load();
  assert.equal(Object.keys(first.data.items).length, SAMPLE_ITEMS.length);
  assert.deepEqual(first.newIds, []);
  first.data.settings.occasion = 'work';
  const source = createSampleSource({ storage, today });
  await source.save(JSON.stringify(first.data));
  assert.equal((await source.load()).data.settings.occasion, 'work');
  assert.ok(source.photoUrl('sample-01').startsWith('data:image/svg+xml,'));
  assert.deepEqual(await source.refresh(first.data), { newIds: [] });
});
