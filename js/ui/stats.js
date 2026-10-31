// Wardrobe stats screen: her wardrobe in numbers (spec §2, Wardrobe stats), from stats.js.
import { SWATCHES } from '../colors.js';
import { append, h, photo, swatch } from './dom.js';
import { colorLabel, OCCASION_LABELS } from './labels.js';

const times = (n) => (n === 1 ? '1 time' : `${n} times`);

function tile(number, label) {
  return h('div', { class: 'stat-tile' },
    h('span', { class: 'stat-number' }, String(number)),
    h('span', { class: 'stat-label' }, label));
}

function mostWorn(stats, view) {
  return h('section', { class: 'card stats-card' },
    h('h2', {}, 'Most worn'),
    stats.mostWorn.length
      ? h('div', { class: `pieces count-${stats.mostWorn.length}` }, stats.mostWorn.map(({ id, count }) => h('figure', { class: 'piece' },
        photo(view.photoUrl(id), view.fileName(id)),
        h('figcaption', {}, times(count)))))
      : h('p', { class: 'hint' }, 'Your most-worn pieces show up here once you tap Wore this.'));
}

// One bar split by color, as wide as each color's share of her pieces, and the counts under it.
function colorMix(stats) {
  const total = stats.colors.reduce((sum, { count }) => sum + count, 0);
  return h('section', { class: 'card stats-card' },
    h('h2', {}, 'Colors'),
    total
      ? [
        h('div', { class: 'color-bar', 'aria-hidden': 'true' }, stats.colors.map(({ color, count }) => h('span', {
          style: `background:${SWATCHES[color]};flex-grow:${count}`,
        }))),
        h('ul', { class: 'color-legend' }, stats.colors.map(({ color, count }) => h('li', {}, swatch(SWATCHES[color]), `${colorLabel(color)} ${count}`))),
      ]
      : h('p', { class: 'hint' }, 'Label your pieces to see your colors.'));
}

function occasions(stats) {
  const most = stats.occasions[0]?.count ?? 0;
  return h('section', { class: 'card stats-card' },
    h('h2', {}, 'What you dress for'),
    most
      ? stats.occasions.map(({ occasion, count }) => h('div', { class: 'occasion-row' },
        h('span', {}, OCCASION_LABELS[occasion]),
        h('span', { class: 'occasion-bar', style: `width:${Math.round((count / most) * 100)}%`, 'aria-hidden': 'true' }),
        h('span', { class: 'occasion-count' }, String(count))))
      : h('p', { class: 'hint' }, 'Tap Wore this on an outfit to see what you dress for.'));
}

export function renderStats(root, view, actions) {
  const { stats } = view;
  append(root,
    h('header', { class: 'topbar' },
      h('button', { class: 'link', onclick: actions.back }, 'Back'),
      h('h1', {}, 'Wardrobe stats'),
      h('span', { class: 'topbar-spacer' })),
    h('div', { class: 'stat-tiles' },
      tile(stats.pieces, stats.pieces === 1 ? 'piece' : 'pieces'),
      tile(stats.worn, stats.worn === 1 ? 'outfit worn' : 'outfits worn'),
      tile(stats.thisMonth, 'this month'),
      tile(stats.neverWorn, 'never worn')),
    mostWorn(stats, view),
    colorMix(stats),
    occasions(stats));
}
