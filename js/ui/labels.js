// Words shown on screen for the app's values.
export const OCCASION_LABELS = { everyday: 'Everyday', work: 'Work', evening: 'Evening out', special: 'Special event' };
export const TEMPERATURE_LABELS = { cold: 'Cold', mild: 'Mild', hot: 'Hot' };
export const WARMTH_LABELS = { light: 'Light', medium: 'Medium', warm: 'Warm' };
export const STYLE_LABELS = { casual: 'Casual', smart: 'Smart', dressy: 'Dressy' };

export function colorLabel(color) {
  return color[0].toUpperCase() + color.slice(1);
}
