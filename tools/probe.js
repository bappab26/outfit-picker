// One-off checks of the three risks in the spec (§8). Not part of the app.
import { CLIENT_ID, AUTHORITY, SCOPES, WARDROBE_FOLDER, isAppId, redirectUri } from '../js/config.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const logEl = document.getElementById('log');
const log = (line) => { logEl.textContent += line + '\n'; };
const pass = (name, detail = '') => log(`PASS  ${name}${detail ? ' — ' + detail : ''}`);
const fail = (name, detail = '') => log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`);

let pca;
let account = null;

async function init() {
  const standalone = matchMedia('(display-mode: standalone)').matches;
  log(`1. Mode: display-mode standalone = ${standalone}, navigator.standalone = ${navigator.standalone}`);
  if (!isAppId(CLIENT_ID)) {
    fail('Setup', 'paste your Application (client) ID into js/config.js first');
    return;
  }
  if (typeof msal === 'undefined') {
    fail('Setup', 'the Microsoft sign-in library did not load (offline?)');
    return;
  }
  pca = new msal.PublicClientApplication({
    auth: { clientId: CLIENT_ID.trim(), authority: AUTHORITY, redirectUri: redirectUri() },
    cache: { cacheLocation: 'localStorage' },
  });
  await pca.initialize();
  try {
    const result = await pca.handleRedirectPromise();
    account = result?.account ?? pca.getAllAccounts()[0] ?? null;
  } catch (e) {
    fail('2. Signed in (redirect)', e.message);
  }
  if (account) pass('2. Signed in', account.username);
  else log('2. Not signed in yet. Tap a sign-in button.');
}

async function signIn(popup) {
  if (!pca) return;
  try {
    if (popup) {
      const result = await pca.loginPopup({ scopes: SCOPES });
      account = result.account;
      pass('2. Signed in (popup)', account.username);
    } else {
      await pca.loginRedirect({ scopes: SCOPES });
    }
  } catch (e) {
    fail(`2. Signed in (${popup ? 'popup' : 'redirect'})`, e.message);
  }
}

async function token() {
  const result = await pca.acquireTokenSilent({ scopes: SCOPES, account });
  return result.accessToken;
}

async function graph(method, path, body, contentType = 'application/json') {
  const headers = { Authorization: `Bearer ${await token()}` };
  if (body !== undefined) headers['Content-Type'] = contentType;
  return fetch(path.startsWith('http') ? path : GRAPH + path, { method, headers, body });
}

async function ensureFolder(parentPath, name) {
  const res = await graph('POST', parentPath, JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }));
  if (!res.ok && res.status !== 409) throw new Error(`creating ${name}: HTTP ${res.status}`);
}

async function readOnePixel(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, 1, 1);
  return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).join(',');
}

async function runChecks() {
  if (!pca || !account) {
    fail('Run checks', 'sign in first');
    return;
  }
  // 3. Folder
  let image;
  try {
    await ensureFolder('/me/drive/root/children', WARDROBE_FOLDER);
    await ensureFolder(`/me/drive/root:/${WARDROBE_FOLDER}:/children`, 'Tops');
    // The same listing query the app uses (js/onedrive.js).
    const res = await graph('GET', `/me/drive/root:/${WARDROBE_FOLDER}/Tops:/children?$expand=thumbnails&$top=200`);
    if (!res.ok) throw new Error(`listing Tops: HTTP ${res.status}`);
    const images = (await res.json()).value.filter((i) => i.file?.mimeType?.startsWith('image/'));
    pass('3. Folder', `${images.length} image(s) in ${WARDROBE_FOLDER}/Tops`);
    image = images[0];
    if (!image) log('   Add one photo to Wardrobe/Tops in OneDrive and run the checks again.');
    else {
      const url = image.thumbnails?.[0]?.medium?.url;
      (url ? pass : fail)('3b. Thumbnails in listing', url ? 'yes' : 'no — photos would show their file names');
      log(`   first photo: ${image.name}, type ${image.file.mimeType}`);
    }
  } catch (e) {
    fail('3. Folder', e.message);
  }

  if (image) {
    // 4. Thumbnail pixels
    try {
      const url = image.thumbnails?.[0]?.medium?.url;
      if (!url) throw new Error('no medium thumbnail');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      pass('4. Thumbnail pixels', `first pixel ${await readOnePixel(await res.blob())}`);
    } catch (e) {
      fail('4. Thumbnail pixels', e.message);
    }
    // 5. Download pixels
    try {
      const res = await graph('GET', `/me/drive/items/${image.id}`);
      if (!res.ok) throw new Error(`item: HTTP ${res.status}`);
      const url = (await res.json())['@microsoft.graph.downloadUrl'];
      if (!url) throw new Error('no download URL');
      const file = await fetch(url);
      if (!file.ok) throw new Error(`download: HTTP ${file.status}`);
      pass('5. Download pixels', `first pixel ${await readOnePixel(await file.blob())}`);
    } catch (e) {
      fail('5. Download pixels', e.message);
    }
  }

  // 6. App folder: written and read back the way the app does it (js/onedrive.js)
  try {
    const path = '/me/drive/special/approot:/probe.json';
    const put = await graph('PUT', `${path}:/content`, '{"ok":true}');
    if (!put.ok) throw new Error(`write: HTTP ${put.status}`);
    const item = await graph('GET', path);
    if (!item.ok) throw new Error(`read: HTTP ${item.status}`);
    const url = (await item.json())['@microsoft.graph.downloadUrl'];
    if (!url) throw new Error('no download address');
    const file = await fetch(url);
    if (!file.ok) throw new Error(`download: HTTP ${file.status}`);
    const text = await file.text();
    if (JSON.parse(text).ok !== true) throw new Error(`read back ${text}`);
    pass('6. App folder', 'wrote and read probe.json');
  } catch (e) {
    fail('6. App folder', e.message);
  }
}

document.getElementById('signin-redirect').addEventListener('click', () => signIn(false));
document.getElementById('signin-popup').addEventListener('click', () => signIn(true));
document.getElementById('run').addEventListener('click', runChecks);
document.getElementById('copy').addEventListener('click', () => navigator.clipboard?.writeText(logEl.textContent));

init();
