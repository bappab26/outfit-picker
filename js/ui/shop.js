// Shop check screen (spec 2026-10-31-shop-check-wishlist-design.md, §2): check a piece she's
// thinking of buying against her wardrobe, and her wishlist.
import { FOLDERS } from '../config.js';
import { STYLES, WARMTHS } from '../rules.js';
import { SHOP_ID, shopVerdict } from '../shop.js';
import { append, choices, h, photo, tapAttrs } from './dom.js';
import { colorChoice } from './label.js';
import { STYLE_LABELS, TYPE_LABELS, WARMTH_LABELS, colorLabel } from './labels.js';

const outfits = (n) => (n === 1 ? 'Goes with 1 outfit' : `Goes with ${n} outfits`);
const title = ({ color, category, style }) => `${colorLabel(color)} · ${TYPE_LABELS[category]} · ${STYLE_LABELS[style]}`;

// A label around a hidden photo picker, so one tap opens the phone's camera or gallery.
function photoPicker(text, className, actions) {
  const input = h('input', { type: 'file', accept: 'image/*', class: 'file-input' });
  input.addEventListener('change', () => {
    if (input.files[0]) actions.pickPhoto(input.files[0]);
  });
  return h('label', { class: className }, text, input);
}

function wishCard(wish, view, actions) {
  const name = title(wish.labels);
  return h('article', { class: 'card wish-card zoomable', ...tapAttrs(() => actions.openWish(wish.id), `${name}, ${outfits(wish.count)}`) },
    h('div', { class: 'wish-photo' }, photo(view.photoUrl(wish.id), wish.labels.fileName)),
    h('div', { class: 'wish-text' },
      h('strong', {}, name),
      h('span', { class: 'wish-count' }, outfits(wish.count))));
}

// No check open: the photo picker, then the wishlist (newest first).
function startScreen(view, actions) {
  let wishlist;
  if (!view.canWishlist) wishlist = h('p', { class: 'hint' }, 'Sign in to keep a wishlist.');
  else if (!view.wishlist.length) wishlist = h('p', { class: 'hint' }, 'Nothing here yet. Check a piece and tap Save to wishlist.');
  else wishlist = view.wishlist.map((wish) => wishCard(wish, view, actions));
  return [
    photoPicker('🛍️ Check a piece', 'photo-pick', actions),
    h('h2', {}, 'Wishlist'),
    wishlist,
  ];
}

function result(view) {
  if (!view.hasLabeled) return h('p', { class: 'hint' }, "Label a few pieces first, so there's something to compare with.");
  if (!view.result) return null;
  const { count, best } = view.result;
  return h('section', { class: 'card shop-result', role: 'status' },
    h('h2', {}, outfits(count)),
    h('p', { class: 'hint' }, shopVerdict(count)),
    best.length > 0 && [
      h('div', { class: 'group-label' }, 'Best with it'),
      best.map((outfit) => h('div', { class: `pieces shop-outfit count-${outfit.length}` }, outfit.map((p) => h('figure', { class: 'piece' },
        photo(p.id === SHOP_ID ? view.check.photo : view.photoUrl(p.id), p.fileName))))),
    ]);
}

// What she can do with the check: save it, or for a wishlist item, buy or remove it.
function checkActions(view, actions) {
  const { check } = view;
  const busy = Boolean(view.busy);
  if (!check.wishId) {
    return h('div', { class: 'shop-actions' },
      h('button', { onclick: actions.done }, 'Done'),
      view.canWishlist && view.result && h('button', { class: 'primary', disabled: busy, onclick: actions.save }, 'Save to wishlist'));
  }
  if (view.confirmRemove) {
    return h('div', { class: 'confirm', role: 'alertdialog', 'aria-label': 'Remove from your wishlist?' },
      h('p', {}, 'Remove from your wishlist? The photo goes to your OneDrive recycle bin.'),
      h('div', { class: 'confirm-actions' },
        h('button', { onclick: actions.cancelRemove }, 'Cancel'),
        h('button', { class: 'danger', disabled: busy, onclick: actions.confirmRemove }, 'Remove')));
  }
  return h('div', { class: 'shop-actions' },
    h('button', { class: 'danger-link', disabled: busy, onclick: actions.askRemove }, 'Remove'),
    h('button', { onclick: actions.done }, 'Done'),
    h('button', { class: 'primary', disabled: busy, onclick: actions.buy }, 'I bought it'));
}

// A check: the photo, what it is, then what it goes with.
function checkScreen(view, actions) {
  const { check } = view;
  return [
    h('div', { class: 'shop-photo-row' },
      h('div', { class: 'shop-photo' }, photo(check.photo, 'Photo')),
      !check.wishId && photoPicker('Retake photo', 'chip', actions)),
    colorChoice(check.color, actions.setColor),
    choices('What is it?', Object.values(FOLDERS), TYPE_LABELS, check.category, actions.setCategory),
    choices('Style', STYLES, STYLE_LABELS, check.style, actions.setStyle),
    choices('Warmth', WARMTHS, WARMTH_LABELS, check.warmth, actions.setWarmth),
    result(view),
    view.busy && h('p', { class: 'hint', role: 'status' }, view.busy),
    view.note && h('p', { class: 'note', role: 'alert' }, view.note),
    checkActions(view, actions),
  ];
}

export function renderShop(root, view, actions) {
  append(root,
    h('header', { class: 'topbar' },
      h('button', { class: 'link', onclick: actions.back }, 'Back'),
      h('h1', {}, 'Shop check'),
      h('span', { class: 'topbar-spacer' })),
    view.check ? checkScreen(view, actions) : startScreen(view, actions));
}
