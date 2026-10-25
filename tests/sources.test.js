import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOneDriveSource, createSampleSource } from '../js/sources.js';
import { NeedsSignIn } from '../js/errors.js';

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
    // Photos sent, moved and deleted, in order. Uploads whose number is in `failUploads` fail.
    uploads: [],
    failUploads: new Set(),
    moves: [],
    deletes: [],
    failChanges: false,
    async uploadPhoto(category, fileName, blob) {
      const n = g.uploads.length + 1;
      g.uploads.push({ category, fileName, blob });
      if (g.failUploads.has(n)) throw new Error('offline');
      return { id: `up${n}`, category, fileName, thumbUrl: null };
    },
    async movePhoto(id, category, fileName) {
      if (g.failChanges) throw new Error('offline');
      g.moves.push([id, category, fileName]);
      return { fileName: `moved-${fileName}` };
    },
    async deletePhoto(id) {
      if (g.failChanges) throw new Error('offline');
      g.deletes.push(id);
    },
  };
  return g;
}

// Stand-ins for the browser's photo work: shrinking "writes" the photo's text, the color is pink.
const fakePhotos = () => {
  let urls = 0;
  return {
    shrink: async (file) => new Blob([`shrunk ${await file.text()}`], { type: 'image/jpeg' }),
    color: async () => 'pink',
    url: () => `local-url-${++urls}`,
    name: (n) => `photo-${n}.jpg`,
  };
};

function setup({ detect = async () => 'navy', stored, photos = fakePhotos() } = {}) {
  const graph = fakeGraph({ stored });
  const storage = fakeStorage();
  const detected = [];
  const source = createOneDriveSource({
    graph,
    storage,
    today,
    detect: async (e) => { detected.push(e); return detect(e); },
    photos,
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

const photo = (text) => new Blob([text]);

test('addPhotos uploads each photo, shrunk, into its folder and adds it to be labeled', async () => {
  const { graph, source } = setup();
  const { data } = await source.load();
  const { newIds, failed } = await source.addPhotos(data, 'jeans', [photo('one'), photo('two')]);
  assert.deepEqual(newIds, ['up1', 'up2']);
  assert.equal(failed, 0);
  assert.deepEqual(graph.uploads.map((u) => [u.category, u.fileName]), [['jeans', 'photo-1.jpg'], ['jeans', 'photo-2.jpg']]);
  assert.equal(await graph.uploads[0].blob.text(), 'shrunk one');
  assert.deepEqual(data.items.up1, { category: 'jeans', fileName: 'photo-1.jpg', color: 'pink', warmth: null, style: null, addedAt: today, lastWorn: null, wearCount: 0 });
  // OneDrive makes its preview a little later; until then the photo shows from the phone.
  assert.equal(source.photoUrl('up1'), 'local-url-1');
  assert.equal(source.photoUrl('up2'), 'local-url-2');
});

test('addPhotos keeps going after a failed upload and counts it', async () => {
  const { graph, source } = setup();
  const { data } = await source.load();
  graph.failUploads = new Set([1]);
  const { newIds, failed } = await source.addPhotos(data, 'tops', [photo('one'), photo('two')]);
  assert.deepEqual(newIds, ['up2']);
  assert.equal(failed, 1);
  assert.equal(data.items.up1, undefined);
});

test('a photo the phone cannot shrink is uploaded as it is', async () => {
  const photos = { ...fakePhotos(), shrink: async () => { throw new Error('cannot read this photo'); } };
  const { graph, source } = setup({ photos });
  const { data } = await source.load();
  const original = photo('heic');
  await source.addPhotos(data, 'tops', [original]);
  assert.equal(graph.uploads[0].blob, original);
});

test('deletePiece deletes the photo in OneDrive, then the piece', async () => {
  const { graph, source } = setup({ stored: JSON.stringify({ version: 1, items: { a: pieceA() }, pairScores: { 'a|b': 1 } }) });
  const { data } = await source.load();
  await source.deletePiece(data, 'a');
  assert.deepEqual(graph.deletes, ['a']);
  assert.equal(data.items.a, undefined);
  assert.deepEqual(data.pairScores, {});
});

test('movePiece moves the photo and keeps its labels and history', async () => {
  const { graph, source } = setup({ stored: dataWithA({ lastWorn: '2026-10-20', wearCount: 3 }) });
  const { data } = await source.load();
  await source.movePiece(data, 'a', 'sweatshirts');
  assert.deepEqual(graph.moves, [['a', 'sweatshirts', 'a.jpg']]);
  assert.deepEqual(data.items.a, pieceA({ category: 'sweatshirts', fileName: 'moved-a.jpg', lastWorn: '2026-10-20', wearCount: 3 }));
});

test('when OneDrive cannot be reached, moving or deleting leaves the piece as it was', async () => {
  const { graph, source } = setup();
  const { data } = await source.load();
  const before = JSON.stringify(data.items.a);
  graph.failChanges = true;
  await assert.rejects(source.movePiece(data, 'a', 'coats'));
  await assert.rejects(source.deletePiece(data, 'a'));
  assert.equal(JSON.stringify(data.items.a), before);
});

test('sample mode can move and delete pieces but not add photos', async () => {
  const source = createSampleSource({ storage: fakeStorage(), today });
  const { data } = await source.load();
  assert.equal(source.canAdd, false);
  await source.movePiece(data, 'sample-01', 'sweatshirts');
  assert.equal(data.items['sample-01'].category, 'sweatshirts');
  await source.deletePiece(data, 'sample-02');
  assert.equal(data.items['sample-02'], undefined);
});

test('OneDrive mode can add photos', () => {
  assert.equal(setup().source.canAdd, true);
});

test('addPhotos stops when she has to sign in again, instead of counting the photos as failed', async () => {
  const { graph, source } = setup();
  const { data } = await source.load();
  graph.uploadPhoto = async () => { throw new NeedsSignIn(); };
  await assert.rejects(source.addPhotos(data, 'tops', [photo('one'), photo('two')]), NeedsSignIn);
});
