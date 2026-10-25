// Home screen: occasion and temperature choices, then 3 outfit cards (spec §2).
import { OCCASIONS, TEMPERATURES } from '../rules.js';
import { append, choices, h, photo } from './dom.js';
import { APP_NAME, OCCASION_LABELS, TEMPERATURE_LABELS } from './labels.js';

const NOTE_TEXT = {
  'add-shoes': 'Add some shoes',
  'add-main': 'Add at least one top and one pair of pants or skirt, or a dress',
  'add-coat': 'Add a coat to Outerwear',
  'all-recent': 'Everything has been worn recently',
  'no-match': 'No outfits match this occasion and temperature yet. Try another choice, or label more pieces.',
};

const WELCOME = 'Welcome! Save photos of your clothes into the Wardrobe folder in your OneDrive: '
  + 'Tops, Pants, Skirts, Dresses, Shoes and Outerwear. Then come back here to label them.';

function card({ outfit, liked, worn }, i, view, actions) {
  return h('article', { class: 'card' },
    h('div', { class: 'pieces' },
      outfit.items.map((item) => h('figure', { class: 'piece' }, photo(view.photoUrl(item.id), item.fileName)))),
    h('div', { class: 'card-actions' },
      h('button', {
        class: liked ? 'icon on' : 'icon',
        'aria-label': 'Like',
        'aria-pressed': liked ? 'true' : 'false',
        disabled: liked,
        onclick: () => actions.like(i),
      }, '👍'),
      h('button', { class: 'icon', 'aria-label': 'Dislike', onclick: () => actions.dislike(i) }, '👎'),
      h('button', { class: worn ? 'wore done' : 'wore', disabled: worn, onclick: () => actions.wore(i) },
        worn ? 'Worn today ✓' : 'Wore this')));
}

export function renderHome(root, view, actions) {
  const { settings } = view;
  const n = view.newCount;
  append(root,
    view.sampleMode && h('div', { class: 'banner sample' },
      h('span', {}, 'Sample mode'),
      h('button', { class: 'link', onclick: actions.exitSample }, 'Exit')),
    h('header', { class: 'topbar' },
      h('h1', {}, APP_NAME),
      h('button', { class: 'link', onclick: actions.openWardrobe }, 'Wardrobe')),
    view.saveError && h('div', { class: 'banner warn', role: 'status' }, 'Not saved, retrying'),
    n > 0 && h('button', { class: 'banner new', onclick: actions.openLabel },
      `${n} new piece${n === 1 ? '' : 's'} to label`),
  );

  if (!view.hasLabeled) {
    root.append(h('p', { class: 'welcome' }, WELCOME));
    return;
  }

  append(root,
    choices('Occasion', OCCASIONS, OCCASION_LABELS, settings.occasion, actions.setOccasion),
    choices('Temperature', TEMPERATURES, TEMPERATURE_LABELS, settings.temperature, actions.setTemperature),
    h('div', { class: 'toolbar' },
      h('label', { class: 'switch' },
        h('input', { type: 'checkbox', checked: settings.somethingDifferent, onchange: actions.toggleDifferent }),
        h('span', {}, 'Something different')),
      h('button', { class: 'shuffle', onclick: actions.shuffle }, 'Shuffle')),
    view.notes.map((note) => h('p', { class: 'note' }, NOTE_TEXT[note])),
    view.cards.map((c, i) => card(c, i, view, actions)),
  );
}
