// Outfit calendar screen: the days she tapped Wore this, a month at a time
// (spec §2, Outfit calendar).
import { monthWeeks } from '../worn.js';
import { append, h, photo } from './dom.js';
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

// Under the calendar: what she wore on the day picked.
function dayOutfits(view) {
  if (!view.day) {
    return h('p', { class: 'hint' }, view.hasAny ? 'Nothing saved this month.' : 'Tap Wore this on an outfit and it shows up here.');
  }
  if (!view.outfits.length) return h('p', { class: 'hint' }, 'Nothing saved for this day.');
  return view.outfits.map((outfit) => h('section', { class: 'card worn-outfit' },
    h('h2', {}, `${dayTitle(view.day)} · ${OCCASION_LABELS[outfit.occasion]}`),
    outfit.ids.length
      ? h('div', { class: `pieces count-${outfit.ids.length}` },
        outfit.ids.map((id) => h('figure', { class: 'piece' }, photo(view.photoUrl(id), view.fileName(id)))))
      : h('p', { class: 'hint' }, 'These pieces are no longer in your wardrobe.')));
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
    dayOutfits(view));
}
