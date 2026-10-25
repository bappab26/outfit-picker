import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOneDriveSource } from '../js/sources.js';

const today = '2026-10-25';
const PENDING = 'outfit-picker:pending';
const entry = (id) => ({ id, category: 'tops', fileName: `${id}.jpg`, thumbUrl: `https://thumbs.example/${id}` });
const pieceA = (extra = {}) => ({ category: 'tops', fileName: 'a.jpg', color: 'red', warmth: 'light', style: 'casual', addedAt: '2026-10-01', lastWorn: null, wearCount: 0, ...extra });
const dataWithA = (extra) => JSON.stringify({ version: 1, items: { a: pieceA(extra) } });

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

function fakeGraph({ stored = dataWithA() } = {}) {
  const g = {
    calls: { ensureFolders: 0, readData: 0 },
    writes: [],
    // Every file written, in order: { fileName, text }.
    files: [],
    failWrites: false,
    listing: [entry('a'), entry('b')],
    stored,
    async ensureFolders() { g.calls.ensureFolders += 1; },
    async readData() { g.calls.readData += 1; return g.stored; },
    async listWardrobe() { return g.listing; },
    async writeData(text, fileName = 'data.json') {
      if (g.failWrites) throw new Error('offline');
      g.files.push({ fileName, text });
      if (fileName !== 'data.json') return;
      g.writes.push(text);
      g.stored = text;
    },
  };
  return g;
}

function setup({ detect = async () => 'navy', stored } = {}) {
  const graph = fakeGraph({ stored });
  const storage = fakeStorage();
  const detected = [];
  const source = createOneDriveSource({
    graph,
    storage,
    today,
    detect: async (e) => { detected.push(e); return detect(e); },
  });
  return { graph, storage, source, detected };
}

test('load creates folders, merges photos and detects colors of new pieces only', async () => {
  const { graph, source, detected } = setup();
  const { data, newIds } = await source.load();
  assert.equal(graph.calls.ensureFolders, 1);
  assert.deepEqual(detected.map((e) => e.id), ['b']);
  assert.deepEqual(newIds, ['b']);
  assert.equal(data.items.b.color, 'navy');
  assert.equal(data.items.a.color, 'red');
  assert.equal(graph.writes.length, 1);
  assert.equal(JSON.parse(graph.writes[0]).items.b.color, 'navy');
});

test('load does not save when nothing changed', async () => {
  const { graph, source } = setup();
  graph.listing = [entry('a')];
  await source.load();
  assert.equal(graph.writes.length, 0);
});

test('load uses unsaved changes left from last time', async () => {
  const { graph, storage, source } = setup();
  storage.setItem(PENDING, dataWithA({ wearCount: 5 }));
  const { data } = await source.load();
  assert.equal(data.items.a.wearCount, 5);
  assert.equal(graph.calls.readData, 0);
  assert.equal(graph.writes.length, 1);
  assert.equal(storage.getItem(PENDING), null);
});

test('load still opens when saving the merge fails, keeping the change for next time', async () => {
  const { graph, storage, source } = setup();
  graph.failWrites = true;
  const { data } = await source.load();
  assert.equal(data.items.b.color, 'navy');
  assert.equal(JSON.parse(storage.getItem(PENDING)).items.b.color, 'navy');
});

test('an unreadable data file is backed up before it is replaced', async () => {
  const damaged = '{"version":"1","items":{"a":{"category":"tops"}}}';
  const { graph, source } = setup({ stored: damaged });
  await source.load();
  assert.deepEqual(graph.files[0], { fileName: 'data-backup-2026-10-25.json', text: damaged });
  assert.equal(graph.files[1].fileName, 'data.json');
});

test('a readable data file is not backed up', async () => {
  const { graph, source } = setup();
  await source.load();
  assert.ok(graph.files.every((f) => f.fileName === 'data.json'));
});

test('if the backup cannot be written, the damaged file is left alone', async () => {
  const { graph, source } = setup({ stored: 'not json' });
  graph.failWrites = true;
  await assert.rejects(source.load());
  assert.equal(graph.stored, 'not json');
});

test('a failed color detection leaves the color empty', async () => {
  const { source } = setup({ detect: async () => { throw new Error('no pixels'); } });
  const { data, newIds } = await source.load();
  assert.deepEqual(newIds, ['b']);
  assert.equal(data.items.b.color, null);
});

test('save keeps the change in the browser until OneDrive confirms it', async () => {
  const { graph, storage, source } = setup();
  graph.failWrites = true;
  await assert.rejects(source.save('{"version":1}'));
  assert.equal(storage.getItem(PENDING), '{"version":1}');
  graph.failWrites = false;
  await source.save('{"version":1}');
  assert.equal(storage.getItem(PENDING), null);
});

test('photoUrl returns the thumbnail from the latest listing', async () => {
  const { source } = setup();
  await source.load();
  assert.equal(source.photoUrl('a'), 'https://thumbs.example/a');
  assert.equal(source.photoUrl('zzz'), null);
});

test('refresh drops deleted photos and finds new ones', async () => {
  const { graph, source } = setup();
  const { data } = await source.load();
  graph.listing = [entry('b'), entry('c')];
  const { newIds } = await source.refresh(data);
  assert.equal(data.items.a, undefined);
  assert.deepEqual(newIds, ['c']);
  assert.equal(data.items.c.color, 'navy');
  assert.equal(JSON.parse(graph.writes.at(-1)).items.a, undefined);
});
