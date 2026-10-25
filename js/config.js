// Settings for connecting to Microsoft. See README.md, "Setup".

// The "Application (client) ID" from your Microsoft app registration, kept between the quotes.
// This is the only line to change here.
export const CLIENT_ID = '0fea44b6-712c-4aaa-9cf6-12a3a40cbb7f';

export const AUTHORITY = 'https://login.microsoftonline.com/common';
export const SCOPES = ['Files.ReadWrite'];

export const WARDROBE_FOLDER = 'Wardrobe';
export const DATA_FILE = 'data.json';

// OneDrive subfolder name → piece type. The order is the wardrobe screen order.
export const FOLDERS = {
  Tops: 'tops',
  Pants: 'pants',
  Skirts: 'skirts',
  Dresses: 'dresses',
  Shoes: 'shoes',
  Outerwear: 'outerwear',
};

// Set from the probe (docs/superpowers/probe-results.md).
// How the app reads a photo's pixels to detect its color:
// 'thumbnail' (OneDrive's small preview) or 'download' (the full photo).
export const IMAGE_STRATEGY = 'thumbnail';
// How sign-in works when the app is opened from a phone's home screen:
// 'redirect', 'popup', or 'safari-only' (use it from a Safari bookmark instead).
export const HOME_SCREEN_SIGNIN = 'redirect';

// True when `value` looks like an application (client) ID: 8-4-4-4-12 hexadecimal characters.
export function isAppId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

// The address Microsoft sends her back to after sign-in: this page, without "index.html".
export function redirectUri() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}
