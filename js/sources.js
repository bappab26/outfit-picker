// Where the wardrobe comes from: the built-in sample (saved in the browser) or OneDrive.
// Both give the app the same Source shape: load, refresh, photoUrl, save.
import { drawItem, sampleData } from './sample.js';
import { isReadable, mergeListing, parseData } from './store.js';

const SAMPLE_KEY = 'outfit-picker:sample';
// A copy of the data that hasn't reached OneDrive yet, kept until it does.
const PENDING_KEY = 'outfit-picker:pending';
// How many photos' colors to detect at the same time.
const DETECT_AT_ONCE = 4;

async function inBatches(list, size, fn) {
  for (let i = 0; i < list.length; i += size) await Promise.all(list.slice(i, i + size).map(fn));
}

export function createOneDriveSource({ graph, detect, storage, today }) {
  const thumbs = new Map();

  async function save(text) {
    storage.setItem(PENDING_KEY, text);
    await graph.writeData(text);
    storage.removeItem(PENDING_KEY);
  }

  // Saving after a merge is best effort: on failure the pending copy stays and is used next time.
  async function trySave(data) {
    try {
      await save(JSON.stringify(data));
    } catch {
      /* kept in PENDING_KEY */
    }
  }

  async function sync(data) {
    const listing = await graph.listWardrobe();
    thumbs.clear();
    for (const e of listing) thumbs.set(e.id, e.thumbUrl);
    const { newIds, changed } = mergeListing(data, listing, today);
    const byId = new Map(listing.map((e) => [e.id, e]));
    await inBatches(newIds, DETECT_AT_ONCE, async (id) => {
      try {
        data.items[id].color = await detect(byId.get(id));
      } catch {
        /* she picks the color while labeling */
      }
    });
    return { newIds, changed };
  }

  return {
    mode: 'onedrive',
    async load() {
      await graph.ensureFolders();
      const pending = storage.getItem(PENDING_KEY);
      const text = pending ?? (await graph.readData());
      // An unreadable file is about to be replaced by fresh data: keep a copy of it first.
      if (text != null && !isReadable(text)) await graph.writeData(text, `data-backup-${today}.json`);
      const data = parseData(text);
      const { newIds, changed } = await sync(data);
      if (changed || pending) await trySave(data);
      return { data, newIds };
    },
    async refresh(data) {
      const { newIds, changed } = await sync(data);
      if (changed) await trySave(data);
      return { newIds };
    },
    photoUrl(id) {
      return thumbs.get(id) ?? null;
    },
    save,
  };
}

export function createSampleSource({ storage, today }) {
  let current = null;
  return {
    mode: 'sample',
    async load() {
      const saved = storage.getItem(SAMPLE_KEY);
      current = saved ? parseData(saved) : sampleData(today);
      return { data: current, newIds: [] };
    },
    async refresh() {
      return { newIds: [] };
    },
    photoUrl(id) {
      const item = current?.items[id];
      return item ? drawItem(item.category, item.color) : null;
    },
    async save(text) {
      storage.setItem(SAMPLE_KEY, text);
    },
  };
}
