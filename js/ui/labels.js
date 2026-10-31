// Words shown on screen for the app's values.

// The app's name until she picks her own (also in index.html and manifest.webmanifest).
export const DEFAULT_NAME = 'lil evil';
// This version's number: raise it with every update (see README, "Put it online"). The number
// after "1." is the one in CACHE_NAME in sw.js.
export const VERSION_NUMBER = '1.25';
export const VERSION_LINE = `${VERSION_NUMBER} · by bap bap`;

export const OCCASION_LABELS = { everyday: 'Everyday', work: 'Work', evening: 'Evening out', special: 'Special event', home: 'At home' };
export const TEMPERATURE_LABELS = { cold: 'Cold', mild: 'Mild', hot: 'Hot' };
export const WARMTH_LABELS = { light: 'Light', medium: 'Medium', warm: 'Warm' };
export const STYLE_LABELS = { cozy: 'Cozy', casual: 'Casual', smart: 'Smart', dressy: 'Dressy' };
export const SHAPE_LABELS = { dress: 'dresses', skirt: 'skirts', pants: 'pants', shorts: 'shorts' };
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
// Monday first, like the weeks of the outfit calendar.
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Shown under Warmth while labeling: what warmth changes for this kind of piece
// (fitsTemperature and the jacket and coat rules in rules.js).
export function warmthHint(category) {
  const scale = 'Light = thin, Medium = in between, Warm = thick.';
  if (category === 'jackets' || category === 'coats') {
    return `${scale} Light ones are for mild days, Warm ones for cold days, Medium ones for both.`;
  }
  if (category === 'pants' || category === 'jeans' || category === 'shoes') {
    return `${scale} Light ones stay home when it's cold, Warm ones when it's hot.`;
  }
  if (category === 'shorts') {
    return `${scale} Light and Medium work the same; Warm ones stay home when it's hot. `
      + "Shorts are never suggested when it's cold.";
  }
  return `${scale} For ${category}, Light and Medium work the same; only Warm ones stay home when it's hot.`;
}

export function colorLabel(color) {
  return color[0].toUpperCase() + color.slice(1);
}
