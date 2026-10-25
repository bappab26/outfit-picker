// Where the wardrobe comes from: the built-in sample (saved in the browser) or OneDrive.
// Both give the app the same Source shape: load, refresh, photoUrl, save, and
// movePiece and deletePiece; OneDrive can also addPhotos (`canAdd`).
import { classifyError } from './errors.js';
import { drawItem, sampleData } from './sample.js';
import { addPiece, isReadable, mergeListing, parseData, removePieces } from './store.js';

// Numbered so a sample saved by an older version (before the diary and the new folders) is replaced.
const SAMPLE_KEY = 'outfit-picker:sample-3';
// A copy of the data that hasn't reached OneDrive yet, kept until it does.
const PENDING_KEY = 'outfit-picker:pending';
// How many photos' colors to detect at the same time.
const DETECT_AT_ONCE = 4;

async function inBatches(list, size, fn) {
  for (let i = 0; i < list.length; i += size) await Promise.all(list.slice(i, i + size).map(fn));
}

// `photos` does the browser's part of adding photos: shrink(file) → smaller blob,
// color(blob) → its main color, url(blob) → an address to show it, name(n) → a file name.
export function createOneDriveSource({ graph, detect, storage, today, photos }) {
  const thumbs = new Map();
  // Photos added from this phone, shown from the phone until OneDrive has made a preview.
  const added = new Map();

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
      return thumbs.get(id) ?? added.get(id) ?? null;
    },
    save,
    canAdd: true,
    // Uploads the photos into the folder for `category`, one at a time, and adds them as
    // unlabeled pieces. A failed upload is counted and skipped.
    async addPhotos(data, category, files) {
      const newIds = [];
      let failed = 0;
      for (const [i, file] of files.entries()) {
        let blob = file;
        try {
          blob = await photos.shrink(file);
        } catch {
          /* a photo the browser can't read is sent as it is; OneDrive still previews it */
        }
        let entry;
        try {
          entry = await graph.uploadPhoto(category, photos.name(i + 1), blob);
        } catch (e) {
          // Signing in again can't wait for the other photos.
          if (['signin', 'redirecting'].includes(classifyError(e))) throw e;
          failed += 1;
          continue;
        }
        addPiece(data, entry, today);
        added.set(entry.id, photos.url(blob));
        try {
          data.items[entry.id].color = await photos.color(blob);
        } catch {
          /* she picks the color while labeling */
        }
        newIds.push(entry.id);
      }
      return { newIds, failed };
    },
    // Both change OneDrive first, so the piece stays as it was if that fails.
    async movePiece(data, id, category) {
      const { fileName } = await graph.movePhoto(id, category, data.items[id].fileName);
      Object.assign(data.items[id], { category, fileName });
    },
    async deletePiece(data, id) {
      await graph.deletePhoto(id);
      removePieces(data, [id]);
      added.delete(id);
    },
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
    // Sample clothes are drawings, so there are no photos to add.
    canAdd: false,
    async movePiece(data, id, category) {
      data.items[id].category = category;
    },
    async deletePiece(data, id) {
      removePieces(data, [id]);
    },
  };
}
