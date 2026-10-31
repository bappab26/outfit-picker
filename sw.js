// Keeps a copy of the app's own files so it opens fast from the home screen.
// Each open shows the saved copy and quietly fetches a fresh one for next time.
// Raise the number in CACHE_NAME to drop the old copy at once (see README, "Put it online").
const CACHE_NAME = 'outfit-picker-v21';

const APP_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/auth.js',
  'js/colors.js',
  'js/config.js',
  'js/dates.js',
  'js/eggs.js',
  'js/errors.js',
  'js/feedback.js',
  'js/habits.js',
  'js/keys.js',
  'js/onedrive.js',
  'js/photos.js',
  'js/rules.js',
  'js/sample.js',
  'js/settings.js',
  'js/sources.js',
  'js/store.js',
  'js/worn.js',
  'js/ui/dom.js',
  'js/ui/eggs.js',
  'js/ui/home.js',
  'js/ui/intro.js',
  'js/ui/label.js',
  'js/ui/labels.js',
  'js/ui/party.js',
  'js/ui/wardrobe.js',
  'js/ui/worn.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/@azure/msal-browser@4.30.0/lib/msal-browser.min.js',
];

const APP_URLS = new Set(APP_FILES.map((file) => new URL(file, self.registration.scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE_NAME) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  // Everything else (OneDrive, photos, Microsoft sign-in) goes straight to the network.
  if (request.method !== 'GET' || !APP_URLS.has(url.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const saved = await cache.match(url.href);
    const fresh = fetch(request)
      .then((response) => {
        if (response.ok) cache.put(url.href, response.clone());
        return response;
      })
      .catch(() => saved);
    if (saved) {
      event.waitUntil(fresh);
      return saved;
    }
    return fresh;
  })());
});
