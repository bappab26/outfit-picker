// Outfit calendar screen: the days she tapped Wore this, a month at a time
// (spec §2, Outfit calendar).
import { monthWeeks } from '../worn.js';
import { append, bigOutfit, h, photo, tapAttrs } from './dom.js';
import { MONTH_NAMES, OCCASION_LABELS, WEEKDAY_NAMES } from './labels.js';

// 'Fri, Oct 30'
export function dayTitle(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // getUTCDay: Sunday is 0
  return `${WEEKDAY_NAMES[weekday].slice(0, 3)}, ${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
}

// 'October 2026'
export function monthTitle(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

// A day of the month: dotted when she wore something, outlined when it's today.
function dayButton(day, view, actions) {
  if (!day) return h('span', {});
  const worn = view.wornDays.has(day);
  return h('button', {
    class: worn ? 'day worn' : 'day',
    'aria-pressed': day === view.day ? 'true' : 'false',
    'aria-current': day === view.today && 'date',
    'aria-label': worn ? `${dayTitle(day)}, outfit saved` : dayTitle(day),
    disabled: day > view.today,
    onclick: () => actions.pickDay(day),
  }, String(Number(day.slice(8))));
}

const outfitTitle = (view, outfit) => `${dayTitle(view.day)} · ${OCCASION_LABELS[outfit.occasion]}`;

// Under the calendar: what she wore on the day picked. Tapping an outfit shows it big.
function dayOutfits(view, actions) {
  if (!view.day) {
    return h('p', { class: 'hint' }, view.hasAny ? 'Nothing saved this month.' : 'Tap Wore this on an outfit and it shows up here.');
  }
  if (!view.outfits.length) return h('p', { class: 'hint' }, 'Nothing saved for this day.');
  return view.outfits.map((outfit, i) => {
    const title = outfitTitle(view, outfit);
    if (!outfit.ids.length) {
      return h('section', { class: 'card worn-outfit' },
        h('h2', {}, title),
        h('p', { class: 'hint' }, 'These pieces are no longer in your wardrobe.'));
    }
    return h('section', { class: 'card worn-outfit zoomable', ...tapAttrs(() => actions.zoom(i), `${title}: see it bigger`) },
      h('h2', {}, title),
      h('div', { class: `pieces count-${outfit.ids.length}` },
        outfit.ids.map((id) => h('figure', { class: 'piece' }, photo(view.photoUrl(id), view.fileName(id))))));
  });
}

// The outfit tapped, big. Just to look at: that day is over, so no buttons.
function bigWorn(view, actions) {
  const outfit = view.outfits[view.zoomed];
  if (!outfit?.ids.length) return null;
  return bigOutfit(outfit.ids.map((id) => ({ url: view.photoUrl(id), fileName: view.fileName(id) })), {
    top: h('h2', {}, outfitTitle(view, outfit)),
    opening: view.zoomOpening,
    onClose: actions.closeZoom,
  });
}

export function renderWorn(root, view, actions) {
  append(root,
    h('header', { class: 'topbar' },
      h('button', { class: 'link', onclick: actions.back }, 'Back'),
      h('h1', {}, 'Outfit calendar'),
      h('span', { class: 'topbar-spacer' })),
    h('div', { class: 'month-bar' },
      h('button', { class: 'icon', 'aria-label': 'Previous month', disabled: !view.canGoBack, onclick: actions.prevMonth }, '‹'),
      h('h2', {}, monthTitle(view.month)),
      h('button', { class: 'icon', 'aria-label': 'Next month', disabled: !view.canGoForward, onclick: actions.nextMonth }, '›')),
    h('div', { class: 'calendar' },
      WEEKDAY_NAMES.map((name) => h('span', { class: 'weekday', 'aria-hidden': 'true' }, name[0])),
      monthWeeks(view.month).flat().map((day) => dayButton(day, view, actions))),
    dayOutfits(view, actions),
    view.zoomed !== null && bigWorn(view, actions));
}
