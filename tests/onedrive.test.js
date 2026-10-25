import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGraph, GraphError } from '../js/onedrive.js';

const G = 'https://graph.microsoft.com/v1.0';
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
const image = (id) => ({ id, name: `${id}.jpg`, file: { mimeType: 'image/jpeg' }, thumbnails: [{ medium: { url: `https://thumbs.example/${id}` } }] });

// A fake fetch: records every request and answers from [predicate, respond] routes (404 otherwise).
function fakeFetch(routes = []) {
  const requests = [];
  const fn = async (url, init = {}) => {
    const req = { method: init.method ?? 'GET', url, headers: init.headers ?? {}, body: init.body };
    requests.push(req);
    for (const [matches, respond] of routes) if (matches(req)) return respond(req);
    return new Response('not found', { status: 404 });
  };
  return { fn, requests };
}

const graphWith = (routes, extra = {}) => {
  const f = fakeFetch(routes);
  return { graph: createGraph({ getToken: async () => 'test-token', fetchFn: f.fn, ...extra }), requests: f.requests };
};
const isPost = (r) => r.method === 'POST';

test('ensureFolders creates Wardrobe and all its subfolders when Wardrobe is missing', async () => {
  const { graph, requests } = graphWith([[isPost, () => json({}, 201)]]);
  await graph.ensureFolders();
  const posts = requests.filter(isPost);
  assert.deepEqual(posts.map((p) => JSON.parse(p.body).name), ['Wardrobe', 'Tops', 'Hoodies', 'Sweatshirts', 'Pants', 'Jeans', 'Shorts', 'Skirts', 'Dresses', 'Shoes', 'Jackets', 'Coats']);
  assert.equal(posts[0].url, `${G}/me/drive/root/children`);
  assert.ok(posts.slice(1).every((p) => p.url === `${G}/me/drive/root:/Wardrobe:/children`));
  assert.equal(JSON.parse(posts[0].body)['@microsoft.graph.conflictBehavior'], 'fail');
});

test('ensureFolders only creates missing subfolders', async () => {
  const { graph, requests } = graphWith([
    [(r) => r.method === 'GET' && r.url.startsWith(`${G}/me/drive/root:/Wardrobe:/children`),
      () => json({ value: [{ name: 'Tops', folder: {} }, { name: 'shoes', folder: {} }, { name: 'Pants.jpg', file: {} }] })],
    [isPost, () => json({}, 201)],
  ]);
  await graph.ensureFolders();
  assert.deepEqual(requests.filter(isPost).map((p) => JSON.parse(p.body).name), ['Hoodies', 'Sweatshirts', 'Pants', 'Jeans', 'Shorts', 'Skirts', 'Dresses', 'Jackets', 'Coats']);
});

test('ensureFolders treats 409 as already created', async () => {
  const { graph } = graphWith([[isPost, () => new Response('exists', { status: 409 })]]);
  await assert.doesNotReject(graph.ensureFolders());
});

test('listWardrobe follows paging and keeps only images', async () => {
  const { graph, requests } = graphWith([
    [(r) => r.url.includes('/Wardrobe/Tops:/children'),
      () => json({ value: [image('a'), image('b')], '@odata.nextLink': `${G}/next-page-token` })],
    [(r) => r.url === `${G}/next-page-token`,
      () => json({ value: [image('c'), { id: 'v', name: 'v.mp4', file: { mimeType: 'video/mp4' } }, { id: 'p', name: 'p.pdf', file: { mimeType: 'application/pdf' } }] })],
    [(r) => r.url.includes('/Wardrobe/'), () => json({ value: [] })],
  ]);
  const list = await graph.listWardrobe();
  assert.deepEqual(list.map((e) => e.id), ['a', 'b', 'c']);
  assert.ok(list.every((e) => e.category === 'tops' && e.thumbUrl === `https://thumbs.example/${e.id}`));
  assert.deepEqual(list[0], { id: 'a', category: 'tops', fileName: 'a.jpg', thumbUrl: 'https://thumbs.example/a' });
  assert.ok(requests.some((r) => r.url === `${G}/next-page-token`));
  const tops = requests.find((r) => r.url.includes('/Wardrobe/Tops:/children'));
  // No $select: it isn't guaranteed to keep the expanded thumbnails in the answer.
  assert.equal(tops.url, `${G}/me/drive/root:/Wardrobe/Tops:/children?$expand=thumbnails&$top=200`);
});

test('listWardrobe maps each folder to its piece type', async () => {
  const { graph } = graphWith([
    [(r) => r.url.includes('/Wardrobe/Coats:/children'), () => json({ value: [image('coat')] })],
    [(r) => r.url.includes('/Wardrobe/Skirts:/children'), () => json({ value: [image('skirt')] })],
    [(r) => r.url.includes('/Wardrobe/'), () => json({ value: [] })],
  ]);
  const list = await graph.listWardrobe();
  assert.deepEqual(list.map((e) => [e.id, e.category]).sort(), [['coat', 'coats'], ['skirt', 'skirts']]);
});

test('readData returns null when there is no data file', async () => {
  const { graph } = graphWith([]);
  assert.equal(await graph.readData(), null);
});

// Graph's /content answers GET with a redirect, which browsers refuse for requests carrying a
// token; the file is read through its pre-signed download address instead.
test('readData downloads data.json through its download address, without the token', async () => {
  const { graph, requests } = graphWith([
    [(r) => r.method === 'GET' && r.url === `${G}/me/drive/special/approot:/data.json`,
      () => json({ id: 'd', '@microsoft.graph.downloadUrl': 'https://download.example/data' })],
    [(r) => r.url === 'https://download.example/data', () => new Response('{"version":1}')],
  ]);
  assert.equal(await graph.readData(), '{"version":1}');
  assert.equal(requests[0].headers.Authorization, 'Bearer test-token');
  assert.equal(requests[1].headers.Authorization, undefined);
  assert.ok(!requests.some((r) => r.method === 'GET' && r.url.endsWith(':/content')));
});

test('writeData saves data.json in the app folder as JSON', async () => {
  const { graph, requests } = graphWith([[(r) => r.method === 'PUT', () => json({}, 200)]]);
  await graph.writeData('{"version":1}');
  const last = requests.at(-1);
  assert.equal(last.method, 'PUT');
  assert.equal(last.url, `${G}/me/drive/special/approot:/data.json:/content`);
  assert.equal(last.headers['Content-Type'], 'application/json');
  assert.equal(last.body, '{"version":1}');
});

test('every Graph request sends the token', async () => {
  const { graph, requests } = graphWith([
    [isPost, () => json({}, 201)],
    [(r) => r.url.includes('/Wardrobe/'), () => json({ value: [] })],
  ]);
  await graph.ensureFolders();
  await graph.listWardrobe();
  await graph.readData();
  assert.ok(requests.length >= 14);
  assert.ok(requests.every((r) => r.headers.Authorization === 'Bearer test-token'));
});

test('errors carry the HTTP status, and network failures use status 0', async () => {
  const { graph } = graphWith([[() => true, () => new Response('boom', { status: 500 })]]);
  await assert.rejects(graph.readData(), (e) => e instanceof GraphError && e.status === 500);
  const offline = createGraph({ getToken: async () => 't', fetchFn: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(offline.readData(), (e) => e instanceof GraphError && e.status === 0);
});

test('fetchImageBlob reads the thumbnail without the token', async () => {
  const { graph, requests } = graphWith([[(r) => r.url === 'https://thumbs.example/a', () => new Response('pixels')]], { imageStrategy: 'thumbnail' });
  const blob = await graph.fetchImageBlob({ id: 'a', category: 'tops', fileName: 'a.jpg', thumbUrl: 'https://thumbs.example/a' });
  assert.equal(await blob.text(), 'pixels');
  assert.equal(requests[0].headers.Authorization, undefined);
});

test('fetchImageBlob can download the photo through its download address', async () => {
  const { graph, requests } = graphWith([
    [(r) => r.url === `${G}/me/drive/items/a`,
      () => json({ id: 'a', '@microsoft.graph.downloadUrl': 'https://download.example/a' })],
    [(r) => r.url === 'https://download.example/a', () => new Response('full photo')],
  ], { imageStrategy: 'download' });
  const blob = await graph.fetchImageBlob({ id: 'a', category: 'tops', fileName: 'a.jpg', thumbUrl: null });
  assert.equal(await blob.text(), 'full photo');
  assert.equal(requests[0].headers.Authorization, 'Bearer test-token');
  assert.equal(requests[1].headers.Authorization, undefined);
});
