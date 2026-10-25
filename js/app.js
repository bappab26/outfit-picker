// Starts the app, holds its state and switches between screens.
import { accountName, getToken, initAuth, isConfigured, isLibraryLoaded, signIn } from './auth.js';
import { detectImageColor } from './colors.js';
import { todayISO } from './dates.js';
import { classifyError } from './errors.js';
import { dislike, like, woreThis } from './feedback.js';
import { createGraph, GraphError } from './onedrive.js';
import { pickOutfits } from './rules.js';
import { createOneDriveSource, createSampleSource } from './sources.js';
import { allItems, createSaver, labeledItems, unlabeledIds } from './store.js';
import { append, clear, h } from './ui/dom.js';
import { renderHome } from './ui/home.js';
import { renderLabel } from './ui/label.js';
import { APP_NAME } from './ui/labels.js';
import { renderWardrobe } from './ui/wardrobe.js';

const MODE_KEY = 'outfit-picker:mode';
// The email she signed in with, so being signed out (Microsoft's sign-in library forgets her
// after a restart unless she chose "Stay signed in") takes one tap to undo.
const ACCOUNT_KEY = 'outfit-picker:account';
const root = document.getElementById('app');

// localStorage can be missing or throw (private browsing); the app still works without it.
const storage = {
  getItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem(key, value) {
    try { localStorage.setItem(key, value); } catch { /* not saved in this browser */ }
  },
  removeItem(key) {
    try { localStorage.removeItem(key); } catch { /* nothing to remove */ }
  },
};

const state = {
  screen: 'signin',
  source: null,
  data: null,
  saver: null,
  cards: [],
  notes: [],
  saveError: false,
  refreshing: false,
  // The error screen: whether it's a connection problem, and what Retry does.
  error: { offline: false, retry: null },
  // Shown on the sign-in screen after a sign-in problem.
  signinNote: null,
  // Labeling: 'new' walks through `queue`; 'edit' changes one piece from the wardrobe.
  label: { mode: 'new', queue: [], index: 0, id: null },
};

// ----- Outfits -----

function pickOptions(extra = {}) {
  return { ...state.data.settings, today: todayISO(), ...extra };
}

function recompute(extra) {
  const { outfits, notes } = pickOutfits(labeledItems(state.data), state.data, pickOptions(extra));
  state.cards = outfits.map((outfit) => ({ outfit, liked: false, worn: false }));
  state.notes = notes;
}

function changed() {
  state.saver.schedule(state.data);
}

const homeActions = {
  setOccasion(occasion) {
    state.data.settings.occasion = occasion;
    changed();
    recompute();
    render();
  },
  setTemperature(temperature) {
    state.data.settings.temperature = temperature;
    changed();
    recompute();
    render();
  },
  toggleDifferent() {
    state.data.settings.somethingDifferent = !state.data.settings.somethingDifferent;
    changed();
    recompute();
    render();
  },
  shuffle() {
    recompute({ exclude: state.cards.map((c) => c.outfit.key) });
    render();
  },
  like(i) {
    like(state.data, state.cards[i].outfit);
    state.cards[i].liked = true;
    changed();
    render();
  },
  dislike(i) {
    const disliked = state.cards[i].outfit;
    dislike(state.data, disliked);
    const others = state.cards.filter((_, j) => j !== i);
    const [next] = pickOutfits(labeledItems(state.data), state.data, pickOptions({
      exclude: [disliked.key, ...others.map((c) => c.outfit.key)],
      avoidItemIds: others.flatMap((c) => c.outfit.items.map((item) => item.id)),
      count: 1,
    })).outfits;
    // Never put the outfit she just turned down straight back on screen.
    if (next && next.key !== disliked.key) state.cards[i] = { outfit: next, liked: false, worn: false };
    else state.cards.splice(i, 1);
    changed();
    render();
  },
  wore(i) {
    woreThis(state.data, state.cards[i].outfit, todayISO());
    state.cards[i].worn = true;
    changed();
    render();
  },
  openLabel() {
    const queue = unlabeledIds(state.data);
    if (!queue.length) return;
    state.label = { mode: 'new', queue, index: 0, id: null };
    show('label');
  },
  openWardrobe() {
    show('wardrobe');
  },
  async exitSample() {
    await state.saver.flush();
    storage.removeItem(MODE_KEY);
    show('signin');
  },
};

function goHome() {
  recompute();
  show('home');
}

// ----- Labeling and wardrobe -----

function labelId() {
  return state.label.mode === 'new' ? state.label.queue[state.label.index] : state.label.id;
}

function nextPiece() {
  state.label.index += 1;
  if (state.label.index >= state.label.queue.length) goHome();
  else show('label');
}

function setLabel(field, value) {
  const item = state.data.items[labelId()];
  item[field] = value;
  changed();
  if (state.label.mode === 'new' && item.color && item.warmth && item.style) nextPiece();
  else render();
}

const labelActions = {
  setColor: (color) => setLabel('color', color),
  setWarmth: (warmth) => setLabel('warmth', warmth),
  setStyle: (style) => setLabel('style', style),
  skip: nextPiece,
  done: () => show('wardrobe'),
  back: () => (state.label.mode === 'new' ? goHome() : show('wardrobe')),
};

const wardrobeActions = {
  edit(id) {
    state.label = { mode: 'edit', queue: [], index: 0, id };
    show('label');
  },
  async refresh() {
    state.refreshing = true;
    render();
    await run(async () => {
      await state.source.refresh(state.data);
      show('wardrobe');
    }, () => {
      show('wardrobe');
      wardrobeActions.refresh();
    });
    state.refreshing = false;
    if (state.screen === 'wardrobe') render();
  },
  back: goHome,
};

// ----- Modes -----

function setSaveError(error) {
  if (error === state.saveError) return;
  state.saveError = error;
  render();
}

async function openWardrobeData(source) {
  state.source = source;
  const { data } = await source.load();
  state.data = data;
  state.saver = createSaver((text) => source.save(text), {
    onStatus: (status) => {
      if (status === 'error') setSaveError(true);
      if (status === 'saved') setSaveError(false);
    },
  });
  recompute();
  show('home');
}

async function enterSample() {
  storage.setItem(MODE_KEY, 'sample');
  await openWardrobeData(createSampleSource({ storage, today: todayISO() }));
}

async function enterOneDrive() {
  show('loading');
  const graph = createGraph({ getToken });
  const detect = async (entry) => detectImageColor(await graph.fetchImageBlob(entry));
  await openWardrobeData(createOneDriveSource({ graph, detect, storage, today: todayISO() }));
  storage.setItem(MODE_KEY, 'onedrive');
  if (accountName()) storage.setItem(ACCOUNT_KEY, accountName());
  state.signinNote = null;
}

const offlineError = () => new GraphError(0, 'the Microsoft sign-in library did not load');

// Runs a step that talks to Microsoft. On failure: sign-in problems go to the sign-in screen
// (Retry would fail the same way); others show the error screen, whose Retry calls `retry`.
async function run(step, retry) {
  try {
    await step();
  } catch (e) {
    const kind = classifyError(e, { online: navigator.onLine !== false });
    if (kind === 'redirecting') return; // the page is leaving for Microsoft's sign-in
    if (kind === 'signin') {
      state.signinNote = 'Please sign in again.';
      show('signin');
      return;
    }
    state.error = { offline: kind === 'offline', retry };
    show('error');
  }
}

async function onSignIn() {
  await run(async () => {
    if (!isLibraryLoaded()) throw offlineError();
    await signIn(storage.getItem(ACCOUNT_KEY)); // a redirect leaves the page here; a popup returns signed in
    await enterOneDrive();
  }, onSignIn);
}

// ----- Screens -----

function renderSignIn() {
  const remembered = storage.getItem(ACCOUNT_KEY);
  append(root, h('section', { class: 'signin' },
    h('h1', {}, APP_NAME),
    h('p', { class: 'lead' }, 'Outfit ideas from the clothes in your OneDrive.'),
    state.signinNote && h('p', { class: 'hint', role: 'status' }, state.signinNote),
    h('button', { class: 'primary', disabled: !isConfigured(), onclick: onSignIn },
      remembered ? `Continue as ${remembered}` : 'Sign in with Microsoft'),
    !isConfigured() && h('p', { class: 'hint' }, 'Add your Microsoft app ID in js/config.js (see README).'),
    h('button', { class: 'secondary', onclick: enterSample }, 'Try with sample clothes')));
}

function renderLoading() {
  append(root, h('section', { class: 'signin' },
    h('h1', {}, APP_NAME),
    h('p', { class: 'lead', role: 'status' }, 'Loading your wardrobe…')));
}

function renderError() {
  append(root, h('section', { class: 'signin' },
    h('h1', {}, APP_NAME),
    h('p', { class: 'lead', role: 'alert' },
      state.error.offline ? "You're offline. Connect to load your wardrobe." : "Couldn't reach OneDrive."),
    h('button', { class: 'primary', onclick: () => state.error.retry() }, 'Retry')));
}

function renderHomeScreen() {
  renderHome(root, {
    settings: state.data.settings,
    cards: state.cards,
    notes: state.notes,
    newCount: unlabeledIds(state.data).length,
    photoUrl: (id) => state.source.photoUrl(id),
    sampleMode: state.source.mode === 'sample',
    saveError: state.saveError,
    hasLabeled: labeledItems(state.data).length > 0,
  }, homeActions);
}

function renderLabelScreen() {
  const id = labelId();
  if (!state.data.items[id]) {
    // The piece disappeared (its photo was deleted); leave the labeling screen.
    state.screen = state.label.mode === 'new' ? 'home' : 'wardrobe';
    if (state.screen === 'home') recompute();
    render();
    return;
  }
  renderLabel(root, {
    item: { id, ...state.data.items[id] },
    photoUrl: state.source.photoUrl(id),
    mode: state.label.mode,
    remaining: state.label.queue.length - state.label.index,
  }, labelActions);
}

function renderWardrobeScreen() {
  renderWardrobe(root, {
    items: allItems(state.data),
    photoUrl: (id) => state.source.photoUrl(id),
    canRefresh: state.source.mode === 'onedrive',
    refreshing: state.refreshing,
  }, wardrobeActions);
}

const SCREENS = {
  signin: renderSignIn,
  loading: renderLoading,
  error: renderError,
  home: renderHomeScreen,
  label: renderLabelScreen,
  wardrobe: renderWardrobeScreen,
};

function render() {
  clear(root);
  SCREENS[state.screen]();
}

function show(screen) {
  state.screen = screen;
  render();
  window.scrollTo(0, 0);
}

// Home-screen install and fast opening (online only; skipped on the local test server).
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* the app works without it */ });
}

// Save right away when she leaves the app, instead of waiting for the save delay.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') state.saver?.flush();
});

async function start() {
  if (storage.getItem(MODE_KEY) === 'sample') {
    await enterSample();
    return;
  }
  if (!isConfigured()) {
    show('signin');
    return;
  }
  await run(async () => {
    if (!isLibraryLoaded()) throw offlineError();
    if (await initAuth()) await enterOneDrive();
    else show('signin');
  }, start);
}

start();
