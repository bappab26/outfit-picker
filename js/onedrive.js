// Talks to OneDrive through Microsoft Graph: the Wardrobe folders, the photos
// in them, the Wishlist folder, and the app's data file (spec §4.3, §4.5).
import { DATA_FILE, FOLDERS, folderOf, IMAGE_STRATEGY, WARDROBE_FOLDER, WISHLIST_FOLDER } from './config.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';

// `status` is the HTTP status, or 0 when the request never reached OneDrive (offline).
export class GraphError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'GraphError';
    this.status = status;
  }
}

export function createGraph({ getToken, fetchFn = (...args) => fetch(...args), imageStrategy = IMAGE_STRATEGY }) {
  async function request(url, init) {
    let res;
    try {
      res = await fetchFn(url, init);
    } catch (e) {
      throw new GraphError(0, e.message);
    }
    return res;
  }

  async function fail(res) {
    throw new GraphError(res.status, await res.text().catch(() => ''));
  }

  // A Graph call with the sign-in token. Statuses in `allow` are returned instead of thrown.
  async function graph(method, pathOrUrl, { body, contentType = 'application/json', allow = [] } = {}) {
    const url = pathOrUrl.startsWith('https://') ? pathOrUrl : GRAPH + pathOrUrl;
    const headers = { Authorization: `Bearer ${await getToken()}` };
    if (body !== undefined) headers['Content-Type'] = contentType;
    const res = await request(url, { method, headers, body });
    if (!res.ok && !allow.includes(res.status)) await fail(res);
    return res;
  }

  // A pre-signed address (thumbnail or download link): no token needed.
  async function download(url) {
    const res = await request(url);
    if (!res.ok) await fail(res);
    return res.blob();
  }

  const wardrobe = `/me/drive/root:/${encodeURIComponent(WARDROBE_FOLDER)}`;
  const wishlist = `/me/drive/root:/${encodeURIComponent(WISHLIST_FOLDER)}`;
  const appFile = (name) => `/me/drive/special/approot:/${encodeURIComponent(name)}`;
  const newFolder = (name) => JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' });

  // A file's pre-signed download address. Reading through /content instead answers with a
  // redirect, which browsers refuse for requests that carry a token.
  async function downloadUrl(path, fileName) {
    const res = await graph('GET', path, { allow: [404] });
    if (res.status === 404) return null;
    const url = (await res.json())['@microsoft.graph.downloadUrl'];
    if (!url) throw new GraphError(404, `no download address for ${fileName}`);
    return url;
  }

  // The images in the folder at `path`, each with `fields` added. A missing folder has none.
  async function listImages(path, fields = {}) {
    const entries = [];
    // No $select: it isn't guaranteed to keep the expanded thumbnails in the answer.
    let next = `${path}:/children?$expand=thumbnails&$top=200`;
    while (next) {
      const res = await graph('GET', next, { allow: [404] });
      if (res.status === 404) break; // folder missing: nothing in it
      const page = await res.json();
      for (const item of page.value ?? []) {
        if (!item.file?.mimeType?.startsWith('image/')) continue;
        // The medium preview (about 176px) for tiles and color detection, the large one (about
        // 800px) for photos shown big.
        const [thumbnail] = item.thumbnails ?? [];
        entries.push({ id: item.id, ...fields, fileName: item.name, thumbUrl: thumbnail?.medium?.url ?? null, bigUrl: thumbnail?.large?.url ?? null });
      }
      next = page['@odata.nextLink'];
    }
    return entries;
  }

  const listFolder = (folder, category) => listImages(`${wardrobe}/${encodeURIComponent(folder)}`, { category });

  return {
    async ensureFolders() {
      const res = await graph('GET', `${wardrobe}:/children?$select=name,folder&$top=200`, { allow: [404] });
      let existing = [];
      if (res.status === 404) {
        await graph('POST', '/me/drive/root/children', { body: newFolder(WARDROBE_FOLDER), allow: [409] });
      } else {
        existing = ((await res.json()).value ?? []).filter((i) => i.folder).map((i) => i.name.toLowerCase());
      }
      for (const name of Object.keys(FOLDERS)) {
        if (existing.includes(name.toLowerCase())) continue;
        await graph('POST', `${wardrobe}:/children`, { body: newFolder(name), allow: [409] });
      }
    },

    async listWardrobe() {
      const lists = await Promise.all(Object.entries(FOLDERS).map(([folder, category]) => listFolder(folder, category)));
      return lists.flat();
    },

    async fetchImageBlob(entry) {
      if (imageStrategy === 'download') {
        const url = await downloadUrl(`/me/drive/items/${encodeURIComponent(entry.id)}`, entry.fileName);
        if (!url) throw new GraphError(404, `${entry.fileName} is gone`);
        return download(url);
      }
      if (!entry.thumbUrl) throw new GraphError(404, `no thumbnail for ${entry.fileName}`);
      return download(entry.thumbUrl);
    },

    // Saves a photo into the Wardrobe folder for `category`. OneDrive renames it if the
    // name is taken, so nothing is ever replaced. Returns it as a listing entry.
    async uploadPhoto(category, fileName, blob) {
      const path = `${wardrobe}/${encodeURIComponent(folderOf(category))}/${encodeURIComponent(fileName)}`;
      const res = await graph('PUT', `${path}:/content?@microsoft.graph.conflictBehavior=rename`, { body: blob, contentType: 'image/jpeg' });
      const item = await res.json();
      return { id: item.id, category, fileName: item.name, thumbUrl: null, bigUrl: null };
    },

    // The Wishlist folder's photos (shop check), as listing entries without a type.
    async listWishlist() {
      return listImages(wishlist);
    },

    // Saves a photo into the Wishlist folder (made first if it's missing), never over another file.
    async uploadToWishlist(fileName, blob) {
      await graph('POST', '/me/drive/root/children', { body: newFolder(WISHLIST_FOLDER), allow: [409] });
      const res = await graph('PUT', `${wishlist}/${encodeURIComponent(fileName)}:/content?@microsoft.graph.conflictBehavior=rename`, { body: blob, contentType: 'image/jpeg' });
      const item = await res.json();
      return { id: item.id, fileName: item.name, thumbUrl: null, bigUrl: null };
    },

    // Moves a photo into the Wardrobe folder for `category`; its id stays the same.
    // If that folder has a photo with the same name, it becomes "name (2).jpg" and so on.
    async movePhoto(id, category, fileName) {
      const folder = await (await graph('GET', `${wardrobe}/${encodeURIComponent(folderOf(category))}`)).json();
      const dot = fileName.lastIndexOf('.');
      const [base, ext] = dot > 0 ? [fileName.slice(0, dot), fileName.slice(dot)] : [fileName, ''];
      for (let n = 1; ; n++) {
        const body = { parentReference: { id: folder.id } };
        if (n > 1) body.name = `${base} (${n})${ext}`;
        const res = await graph('PATCH', `/me/drive/items/${encodeURIComponent(id)}`, { body: JSON.stringify(body), allow: n < 5 ? [409] : [] });
        if (res.status !== 409) return { fileName: (await res.json()).name };
      }
    },

    // OneDrive keeps deleted files in its recycle bin for a while. Already gone is fine.
    async deletePhoto(id) {
      await graph('DELETE', `/me/drive/items/${encodeURIComponent(id)}`, { allow: [404] });
    },

    async readData() {
      const url = await downloadUrl(appFile(DATA_FILE), DATA_FILE);
      return url ? (await download(url)).text() : null;
    },

    // `fileName` other than data.json is for backups.
    async writeData(text, fileName = DATA_FILE) {
      await graph('PUT', `${appFile(fileName)}:/content`, { body: text });
    },
  };
}
