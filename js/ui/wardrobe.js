// Wardrobe screen: every piece, grouped by OneDrive folder (spec §2).
import { SWATCHES } from '../colors.js';
import { FOLDERS } from '../config.js';
import { append, h, photo, swatch } from './dom.js';
import { STYLE_LABELS, WARMTH_LABELS } from './labels.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function lastWornText(iso) {
  if (!iso) return 'Never worn';
  const [y, m, d] = iso.split('-').map(Number);
  const year = y === new Date().getFullYear() ? '' : `, ${y}`;
  return `Last worn ${MONTHS[m - 1]} ${d}${year}`;
}

function tile(item, view, actions) {
  const labeled = item.color && item.warmth && item.style;
  return h('button', { class: 'tile', onclick: () => actions.edit(item.id) },
    photo(view.photoUrl(item.id), item.fileName),
    h('span', { class: 'tile-text' },
      labeled
        ? [swatch(SWATCHES[item.color]), `${WARMTH_LABELS[item.warmth]} · ${STYLE_LABELS[item.style]}`]
        : h('strong', {}, 'Needs labels')),
    h('span', { class: 'tile-sub' }, lastWornText(item.lastWorn)));
}

export function renderWardrobe(root, view, actions) {
  append(root,
    h('header', { class: 'topbar' },
      h('button', { class: 'link', onclick: actions.back }, 'Back'),
      h('h1', {}, 'Wardrobe'),
      view.canRefresh
        ? h('button', { class: 'link', disabled: view.refreshing, onclick: actions.refresh },
          view.refreshing ? 'Refreshing…' : 'Refresh')
        : h('span', { class: 'topbar-spacer' })),
    !view.items.length && h('p', { class: 'hint' }, 'No pieces yet.'),
    Object.entries(FOLDERS).map(([folder, category]) => {
      const items = view.items.filter((i) => i.category === category);
      if (!items.length) return null;
      return h('section', {},
        h('h2', {}, folder),
        h('div', { class: 'tiles' }, items.map((item) => tile(item, view, actions))));
    }),
  );
}
