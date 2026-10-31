// The hidden bits of the home screen (the rules are in eggs.js): the version line's taps and
// hold, the secret card, the birthday card, "One year ago today", late nights, rare cards and
// the 👎 nudge.
import { SWATCHES } from '../colors.js';
import { BIRTHDAY, EGGS, longDate, secretNote } from '../eggs.js';
import { h, photo, swatch } from './dom.js';
import { VERSION_LINE, colorLabel } from './labels.js';

// Taps count toward evil mode; holding it opens the secret card.
export function versionLine(actions) {
  let timer = null;
  const stop = () => {
    clearTimeout(timer);
    timer = null;
  };
  const line = h('footer', { class: 'version secret-line' }, VERSION_LINE);
  line.addEventListener('pointerdown', () => {
    stop();
    timer = setTimeout(() => {
      timer = null;
      actions.openSecret();
    }, EGGS.holdMs);
  });
  line.addEventListener('pointerup', () => {
    if (!timer) return; // held: the secret card is already open
    stop();
    actions.tapVersion();
  });
  line.addEventListener('pointercancel', stop);
  line.addEventListener('pointerleave', stop);
  line.addEventListener('contextmenu', (event) => event.preventDefault());
  return line;
}

// A card over the darkened screen, like the big outfit. A tap on the dark area closes it,
// except right after it opened (the end of the hold that opened it).
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

export function secretCard(stats, view, actions) {
  const rows = [
    ['Pieces', stats.pieces],
    ['Outfits worn', stats.worn],
    stats.mostWorn && ['Most worn', [
      h('span', { class: 'secret-photo' }, photo(view.photoUrl(stats.mostWorn.id), view.fileName(stats.mostWorn.id))),
      `${stats.mostWorn.count} time${stats.mostWorn.count === 1 ? '' : 's'}`]],
    stats.favoriteColor && ['Favorite color', [swatch(SWATCHES[stats.favoriteColor]), colorLabel(stats.favoriteColor)]],
    stats.since && ['Wardrobe started', longDate(stats.since)],
  ].filter(Boolean);
  return overlay(h('div', { class: 'zoom-panel secret', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Secret' },
    // bap bap's note is the card's title.
    h('div', { class: 'zoom-top' }, h('h2', { class: 'secret-note' }, secretNote()), closeButton(actions.closeSecret)),
    h('dl', { class: 'secret-stats' }, rows.map(([label, value]) => [h('dt', {}, label), h('dd', {}, value)]))),
  actions.closeSecret);
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
