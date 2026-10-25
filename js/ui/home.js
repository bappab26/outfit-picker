// Home screen: the app's name, occasion and temperature choices, then 3 outfit cards (spec §2).
import { OCCASIONS, TEMPERATURES } from '../rules.js';
import { append, choices, h, photo } from './dom.js';
import { OCCASION_LABELS, TEMPERATURE_LABELS, VERSION_LINE } from './labels.js';

const NOTE_TEXT = {
  'add-shoes': 'Add some shoes',
  'add-main': 'Add at least one top and one pair of pants, jeans, shorts or a skirt, or a dress',
  'add-coat': 'Add a coat or a jacket',
  'no-match': 'No outfits match this occasion and temperature yet. Try another choice, or label more pieces.',
};

const WELCOME = 'Welcome! Add photos of your clothes, one piece per photo: tap Add clothes, or save them '
  + 'into the Wardrobe folder in your OneDrive (Tops, Hoodies, Sweatshirts, Pants, Jeans, Shorts, Skirts, '
  + 'Dresses, Shoes, Jackets and Coats). Then label them here.';

// The app's name; tapping it lets her rename the app.
function appTitle(view, actions) {
  if (!view.renaming) {
    return h('button', { class: 'app-name', onclick: actions.startRename },
      h('h1', {}, view.name),
      h('span', { class: 'pencil', 'aria-label': 'Rename' }, '✎'));
  }
  const input = h('input', {
    class: 'name-input', type: 'text', value: view.name, maxlength: 40,
    'aria-label': 'Name of the app', autocomplete: 'off', enterkeyhint: 'done',
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') actions.cancelRename();
  });
  queueMicrotask(() => input.select());
  return h('form', {
    class: 'rename',
    onsubmit: (event) => {
      event.preventDefault();
      actions.saveName(input.value);
    },
  },
  input,
  h('button', { type: 'submit', class: 'primary' }, 'Save'),
  h('button', { type: 'button', onclick: actions.cancelRename }, 'Cancel'));
}

function card(c, i, view, actions) {
  const undo = c.undoDislike && h('button', { class: 'link undo', onclick: () => actions.undoDislike(i) }, 'Undo 👎');
  if (!c.outfit) {
    // She turned this outfit down and there was nothing else to show.
    return h('article', { class: 'card' },
      h('div', { class: 'card-top' }, h('span', { class: 'hint' }, 'No other outfit to show.'), undo));
  }
  const { outfit, liked, worn } = c;
  return h('article', { class: 'card' },
    (c.forgotten || undo) && h('div', { class: 'card-top' },
      c.forgotten && h('span', { class: 'tag' }, 'Not worn in a while'),
      undo),
    h('div', { class: `pieces count-${outfit.items.length}` },
      outfit.items.map((item) => h('figure', { class: 'piece' }, photo(view.photoUrl(item.id), item.fileName)))),
    h('div', { class: 'card-actions' },
      // 👍 and Wore this are toggles: a second tap takes them back.
      h('button', {
        class: liked ? 'icon on' : 'icon',
        'aria-label': 'Like',
        'aria-pressed': liked ? 'true' : 'false',
        onclick: () => actions.like(i),
      }, '👍'),
      h('button', { class: 'icon', 'aria-label': 'Dislike', onclick: () => actions.dislike(i) }, '👎'),
      h('button', {
        class: worn ? 'wore done' : 'wore',
        'aria-pressed': worn ? 'true' : 'false',
        onclick: () => actions.wore(i),
      }, worn ? 'Worn today ✓' : 'Wore this')));
}

export function renderHome(root, view, actions) {
  const { settings } = view;
  const n = view.newCount;
  append(root,
    view.sampleMode && h('div', { class: 'banner sample' },
      h('span', {}, 'Sample mode'),
      h('button', { class: 'link', onclick: actions.exitSample }, 'Exit')),
    h('header', { class: 'topbar' },
      appTitle(view, actions),
      // Hidden while renaming, so the name box has room on a phone.
      !view.renaming && h('button', { class: 'link', onclick: actions.openWardrobe }, 'Wardrobe')),
    view.saveError && h('div', { class: 'banner warn', role: 'status' }, 'Not saved, retrying'),
    n > 0 && h('button', { class: 'banner new', onclick: actions.openLabel },
      `${n} new piece${n === 1 ? '' : 's'} to label`),
  );

  if (!view.hasLabeled) {
    append(root,
      h('p', { class: 'welcome' }, WELCOME),
      view.canAdd && h('button', { class: 'primary add-clothes', onclick: actions.addClothes }, '+ Add clothes'),
      h('footer', { class: 'version' }, VERSION_LINE));
    return;
  }

  append(root,
    choices('Occasion', OCCASIONS, OCCASION_LABELS, settings.occasion, actions.setOccasion),
    choices('Temperature', TEMPERATURES, TEMPERATURE_LABELS, settings.temperature, actions.setTemperature),
    h('div', { class: 'toolbar' }, h('button', { class: 'shuffle', onclick: actions.shuffle }, 'Shuffle')),
    view.notes.map((note) => h('p', { class: 'note' }, NOTE_TEXT[note])),
    view.cards.map((c, i) => card(c, i, view, actions)),
    h('footer', { class: 'version' }, VERSION_LINE),
  );
}
