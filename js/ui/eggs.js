// The hidden bits of the home screen (the rules are in eggs.js): the version line's taps, the
// birthday card, "One year ago today", late nights, rare cards and the 👎 nudge.
import { BIRTHDAY } from '../eggs.js';
import { h, photo } from './dom.js';
import { VERSION_LINE } from './labels.js';

// Quick taps on it count toward evil mode.
export function versionLine(actions) {
  return h('footer', { class: 'version secret-line', onclick: actions.tapVersion }, VERSION_LINE);
}

// A card over the darkened screen, like the big outfit. A tap on the dark area closes it,
// except right after it opened (a tap already on its way).
function overlay(panel, onClose) {
  const backdrop = h('div', { class: 'zoom opening' }, panel);
  const openedAt = Date.now();
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop && Date.now() - openedAt > 600) onClose();
  });
  return backdrop;
}

function closeButton(onClose) {
  return h('button', { class: 'icon zoom-close', 'aria-label': 'Close', onclick: onClose }, '×');
}

export function birthdayCard(actions) {
  return overlay(h('div', {
    class: 'zoom-panel birthday', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Chúc mừng sinh nhật', lang: BIRTHDAY.lang,
  },
  h('div', { class: 'party-face', 'aria-hidden': 'true' }, '🥳'),
  h('p', { class: 'birthday-text' }, BIRTHDAY.text),
  h('button', { class: 'primary', onclick: actions.closeBirthday }, BIRTHDAY.thanks)),
  actions.closeBirthday);
}

export function memoryStrip(ids, view, actions) {
  return h('section', { class: 'memory', 'aria-label': 'One year ago today' },
    h('div', { class: 'card-top' },
      h('span', { class: 'memory-title' }, 'One year ago today you wore this'),
      h('button', { class: 'icon memory-close', 'aria-label': 'Hide', onclick: actions.hideMemory }, '×')),
    h('div', { class: `pieces count-${ids.length}` },
      ids.map((id) => h('figure', { class: 'piece' }, photo(view.photoUrl(id), view.fileName(id))))));
}

export const lateNightLine = () => h('p', { class: 'late-night' }, "Go to sleep. Nobody's judging your outfit at this hour 😴");

export const rareTag = () => h('span', { class: 'tag rare-tag' }, '✨ Rare find');

// On a card after a 👎: the piece she keeps saying no to.
export function nudgeBox(id, i, view, actions) {
  return h('div', { class: 'nudge', role: 'status' },
    h('div', { class: 'nudge-photo' }, photo(view.photoUrl(id), view.fileName(id))),
    h('div', {},
      h('p', {}, 'You keep saying no to this one 👀 Why do you even own this?'),
      h('div', { class: 'nudge-actions' },
        h('button', { onclick: () => actions.lookAtPiece(i) }, 'Look at it'),
        h('button', { class: 'link', onclick: () => actions.keepPiece(i) }, 'Keep it'))));
}
