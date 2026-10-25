// Labeling screen: one piece at a time, with its color, warmth and style (spec §2).
import { COLORS, SWATCHES } from '../colors.js';
import { STYLES, WARMTHS } from '../rules.js';
import { append, choices, h, photo, swatch } from './dom.js';
import { STYLE_LABELS, WARMTH_LABELS, colorLabel } from './labels.js';

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
    h('div', { class: 'label-actions' },
      mode === 'new'
        ? h('button', { onclick: actions.skip }, 'Skip')
        : h('button', { class: 'primary', onclick: actions.done }, 'Done')),
  );
}
