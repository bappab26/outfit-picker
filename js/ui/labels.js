// Words shown on screen for the app's values.

// The app's name until she picks her own (also in index.html and manifest.webmanifest).
export const DEFAULT_NAME = 'lil evil wardrobe';
// The date of this version: change it with every update (see README, "Put it online").
export const VERSION = '2026-10-25';
export const VERSION_LINE = `Version ${VERSION} · by bap bap`;

export const OCCASION_LABELS = { everyday: 'Everyday', work: 'Work', evening: 'Evening out', special: 'Special event', home: 'At home' };
export const TEMPERATURE_LABELS = { cold: 'Cold', mild: 'Mild', hot: 'Hot' };
export const WARMTH_LABELS = { light: 'Light', medium: 'Medium', warm: 'Warm' };
export const STYLE_LABELS = { cozy: 'Cozy', casual: 'Casual', smart: 'Smart', dressy: 'Dressy' };
export const SHAPE_LABELS = { dress: 'dresses', skirt: 'skirts', pants: 'pants', shorts: 'shorts' };

export function colorLabel(color) {
  return color[0].toUpperCase() + color.slice(1);
}
