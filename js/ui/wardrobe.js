// Wardrobe screen: every piece, grouped by OneDrive folder, with a search and other sorts (spec §2).
import { SWATCHES } from '../colors.js';
import { FOLDERS } from '../config.js';
import { SORTS, findPieces } from '../find.js';
import { OCCASIONS } from '../rules.js';
import { append, choices, h, photo, swatch } from './dom.js';
import { colorLabel, MONTH_NAMES, OCCASION_LABELS, SHAPE_LABELS, STYLE_LABELS, WARMTH_LABELS } from './labels.js';

const MONTHS = MONTH_NAMES.map((name) => name.slice(0, 3));

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
    h('span', { class: 'tile-sub' }, lastWornText(item.lastWorn)),
    item.note && h('span', { class: 'tile-note' }, item.note));
}

// "Your style so far" (spec §3.6): the habits learned from her choices, from styleSummary().
function styleLines(style) {
  const lines = [];
  if (style.together.length) {
    lines.push(`Often together: ${style.together.map((pair) => pair.map(colorLabel).join(' + ')).join(', ')}`);
  }
  if (style.colors.length) lines.push(`Favorite colors: ${style.colors.map(colorLabel).join(', ')}`);
  for (const occasion of OCCASIONS) {
    const parts = [];
    if (style.shapes[occasion]) parts.push(`mostly ${SHAPE_LABELS[style.shapes[occasion]]}`);
    if (style.dressedUp[occasion]) parts.push(STYLE_LABELS[style.dressedUp[occasion]]);
    if (parts.length) lines.push(`${OCCASION_LABELS[occasion]}: ${parts.join(', ')}`);
  }
  return lines;
}

function styleBox(style) {
  const lines = styleLines(style);
  return h('section', { class: 'style-box' },
    h('h2', {}, 'Your style so far'),
    lines.length
      ? h('ul', {}, lines.map((line) => h('li', {}, line)))
      : h('p', { class: 'hint' }, 'Still learning. Keep tapping Wore this, 👍 and 👎.'));
}

// "Add clothes", then a folder: each folder is a label around a hidden photo picker, so one
// tap opens the phone's camera or gallery (several photos can be picked at once).
function addClothes(view, actions) {
  if (!view.adding) {
    return h('button', { class: 'primary add-clothes', disabled: Boolean(view.busy), onclick: actions.startAdding }, '+ Add clothes');
  }
  return h('section', { class: 'add-box' },
    h('h2', {}, 'Add to which folder?'),
    h('div', { class: 'chips' }, Object.entries(FOLDERS).map(([folder, category]) => {
      const input = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'file-input' });
      input.addEventListener('change', () => actions.addPhotos(category, [...input.files]));
      return h('label', { class: 'chip' }, folder, input);
    })),
    h('button', { class: 'link', onclick: actions.cancelAdding }, 'Cancel'));
}

const SORT_LABELS = { folder: 'Folder', worn: 'Most worn', never: 'Never worn', newest: 'Newest' };

// The pieces that match `query`: by folder, or in one list for the other sorts.
function pieceList(view, actions, query) {
  const found = findPieces(view.items, { query, sort: view.sort });
  let content;
  if (!view.items.length) content = null;
  else if (!found.length) {
    content = h('p', { class: 'hint' }, query.trim() ? 'Nothing matches your search.' : 'Every piece has been worn at least once.');
  } else if (view.sort !== 'folder') {
    content = h('div', { class: 'tiles' }, found.map((item) => tile(item, view, actions)));
  } else {
    content = Object.entries(FOLDERS).map(([folder, category]) => {
      const items = found.filter((i) => i.category === category);
      if (!items.length) return null;
      return h('section', {},
        h('h2', {}, folder),
        h('div', { class: 'tiles' }, items.map((item) => tile(item, view, actions))));
    });
  }
  return h('div', { class: 'piece-list' }, content);
}

// Typing doesn't draw the screen again (the box would lose its place): it remembers the
// search and swaps in the new list.
function searchBox(view, onSearch) {
  const input = h('input', {
    class: 'name-input search-input', type: 'search', value: view.query, placeholder: 'Search: black, jeans, tight…',
    'aria-label': 'Search your wardrobe', autocomplete: 'off', enterkeyhint: 'search',
  });
  input.addEventListener('input', () => onSearch(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') input.blur();
  });
  return input;
}

export function renderWardrobe(root, view, actions) {
  let list = pieceList(view, actions, view.query);
  const search = (query) => {
    actions.search(query);
    const next = pieceList(view, actions, query);
    list.replaceWith(next);
    list = next;
  };
  append(root,
    h('header', { class: 'topbar' },
      h('button', { class: 'link', onclick: actions.back }, 'Back'),
      h('h1', {}, 'Wardrobe'),
      view.canRefresh
        ? h('button', { class: 'link', disabled: view.refreshing, onclick: actions.refresh },
          view.refreshing ? 'Refreshing…' : 'Refresh')
        : h('span', { class: 'topbar-spacer' })),
    view.canAdd && addClothes(view, actions),
    view.busy && h('p', { class: 'hint', role: 'status' }, view.busy),
    view.note && h('p', { class: 'note', role: 'alert' }, view.note),
    !view.items.length && h('p', { class: 'hint' }, 'No pieces yet.'),
    h('div', { class: 'wardrobe-links' },
      h('button', { onclick: actions.openCalendar }, '📅 Calendar'),
      h('button', { onclick: actions.openStats }, '📊 Stats'),
      h('button', { class: 'wide', onclick: actions.openShop }, '🛍️ Shop check')),
    view.style && styleBox(view.style),
    view.items.length > 0 && [
      searchBox(view, search),
      choices('Sort', SORTS, SORT_LABELS, view.sort, actions.setSort),
    ],
    list,
  );
}
