// Labeling screen: one piece at a time, with its color, warmth and style (spec §2).
// Opened from the Wardrobe screen, it also moves the piece to another folder or deletes it.
import { COLORS, SWATCHES } from '../colors.js';
import { FOLDERS } from '../config.js';
import { STYLES, WARMTHS } from '../rules.js';
import { append, choices, h, photo, swatch } from './dom.js';
import { STYLE_LABELS, WARMTH_LABELS, colorLabel } from './labels.js';

// Piece type → its OneDrive folder name, in the Wardrobe screen's order.
const FOLDER_LABELS = Object.fromEntries(Object.entries(FOLDERS).map(([folder, category]) => [category, folder]));

function deleteRow(view, actions) {
  if (!view.confirmDelete) {
    return h('button', { class: 'danger-link', disabled: Boolean(view.busy), onclick: actions.askDelete }, 'Delete piece');
  }
  return h('div', { class: 'confirm', role: 'alertdialog', 'aria-label': 'Delete this piece?' },
    h('p', {}, view.sampleMode ? 'Delete this piece?' : 'Delete this piece? The photo goes to your OneDrive recycle bin.'),
    h('div', { class: 'confirm-actions' },
      h('button', { onclick: actions.cancelDelete }, 'Cancel'),
      h('button', { class: 'danger', disabled: Boolean(view.busy), onclick: actions.confirmDelete }, 'Delete')));
}

export function renderLabel(root, view, actions) {
  const { item, mode } = view;

  // The full color list opens from the current color; it starts open when no color was detected.
  const grid = h('div', { class: 'color-grid', hidden: Boolean(item.color) },
    COLORS.map((c) => h('button', {
      class: 'color-option',
      'aria-pressed': c === item.color ? 'true' : 'false',
      onclick: () => actions.setColor(c),
    }, swatch(SWATCHES[c]), colorLabel(c))));
  const toggleGrid = (event) => {
    grid.hidden = !grid.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!grid.hidden));
  };

  append(root,
    h('header', { class: 'topbar' },
      h('button', { class: 'link', onclick: actions.back }, 'Back'),
      h('h1', {}, mode === 'new' ? `New piece (${view.remaining} left)` : 'Edit piece'),
      h('span', { class: 'topbar-spacer' })),
    h('div', { class: 'label-photo' }, photo(view.photoUrl, item.fileName)),
    h('div', { class: 'group' },
      h('div', { class: 'group-label' }, 'Color'),
      h('button', { class: 'color-current', 'aria-expanded': String(!grid.hidden), onclick: toggleGrid },
        item.color ? [swatch(SWATCHES[item.color]), colorLabel(item.color)] : 'Pick a color'),
      grid),
    choices('Warmth', WARMTHS, WARMTH_LABELS, item.warmth, actions.setWarmth),
    choices('Style', STYLES, STYLE_LABELS, item.style, actions.setStyle),
    mode === 'edit' && choices('Folder', Object.values(FOLDERS), FOLDER_LABELS, item.category, actions.move),
    view.busy && h('p', { class: 'hint', role: 'status' }, view.busy),
    view.note && h('p', { class: 'note', role: 'alert' }, view.note),
    mode === 'new'
      ? h('div', { class: 'label-actions' }, h('button', { onclick: actions.skip }, 'Skip'))
      : h('div', { class: 'label-actions edit' },
        deleteRow(view, actions),
        !view.confirmDelete && h('button', { class: 'primary', onclick: actions.done }, 'Done')),
  );
}
