// Starts the app, holds its state and switches between screens.
import { accountName, getToken, initAuth, isConfigured, isLibraryLoaded, signIn } from './auth.js';
import { detectImageColor } from './colors.js';
import { todayISO } from './dates.js';
import { classifyError } from './errors.js';
import { dislike, like, woreThis } from './feedback.js';
import { learnHabits, styleSummary } from './habits.js';
import { createGraph, GraphError } from './onedrive.js';
import { pickOutfits } from './rules.js';
import { createOneDriveSource, createSampleSource } from './sources.js';
import { allItems, createSaver, labeledItems, tidyName, unlabeledIds } from './store.js';
import { append, clear, h } from './ui/dom.js';
import { renderHome } from './ui/home.js';
import { renderLabel } from './ui/label.js';
import { DEFAULT_NAME, VERSION_LINE } from './ui/labels.js';
import { renderWardrobe } from './ui/wardrobe.js';

const MODE_KEY = 'outfit-picker:mode';
// The email she signed in with, so being signed out (Microsoft's sign-in library forgets her
// after a restart unless she chose "Stay signed in") takes one tap to undo.
const ACCOUNT_KEY = 'outfit-picker:account';
// Her name for the app, so the sign-in screen shows it before her data has loaded.
const NAME_KEY = 'outfit-picker:name';
const root = document.getElementById('app');

// No pinch zoom: iPhones ignore the page's zoom setting, so the gesture itself is stopped.
document.addEventListener('gesturestart', (event) => event.preventDefault());

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
  screen: null, // nothing shown yet, so the first screen fades in too
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
  // True while she is typing a new name for the app.
  renaming: false,
};

function displayName() {
  return state.data?.settings.name ?? storage.getItem(NAME_KEY) ?? DEFAULT_NAME;
}

// Only her own (OneDrive) name is remembered for the sign-in screen, not the sample's.
function rememberName() {
  if (state.source?.mode !== 'onedrive') return;
  if (state.data.settings.name) storage.setItem(NAME_KEY, state.data.settings.name);
  else storage.removeItem(NAME_KEY);
}

// ----- Outfits -----

function pickOptions(extra = {}) {
  const today = todayISO();
  return { ...state.data.settings, today, habits: learnHabits(state.data, today), ...extra };
}

// The day and occasion of a 👍, 👎 or Wore this, for the diary.
function choiceDay() {
  return { today: todayISO(), occasion: state.data.settings.occasion };
}

// A card on the home screen. `undoLike` and `undoWore` take back a 👍 or Wore this;
// `undoDislike` brings back the outfit this card replaced.
function newCard(outfit) {
  return { outfit, forgotten: Boolean(outfit.forgotten), liked: false, worn: false, undoLike: null, undoWore: null, undoDislike: null };
}

function recompute(extra) {
  const { outfits, notes } = pickOutfits(labeledItems(state.data), state.data, pickOptions(extra));
  state.cards = outfits.map(newCard);
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
  shuffle() {
    recompute({ exclude: state.cards.filter((c) => c.outfit).map((c) => c.outfit.key) });
    render();
  },
  like(i) {
    const c = state.cards[i];
    if (c.undoLike) c.undoLike();
    c.undoLike = c.undoLike ? null : like(state.data, c.outfit, choiceDay());
    c.liked = Boolean(c.undoLike);
    c.undoDislike = null; // once she uses the new card, the one it replaced is gone
    changed();
    render();
  },
  wore(i) {
    const c = state.cards[i];
    if (c.undoWore) c.undoWore();
    c.undoWore = c.undoWore ? null : woreThis(state.data, c.outfit, choiceDay());
    c.worn = Boolean(c.undoWore);
    c.undoDislike = null;
    changed();
    render();
  },
  dislike(i) {
    const before = state.cards[i];
    const undo = dislike(state.data, before.outfit, choiceDay());
    const others = state.cards.filter((c, j) => j !== i && c.outfit);
    const [next] = pickOutfits(labeledItems(state.data), state.data, pickOptions({
      exclude: [before.outfit.key, ...others.map((c) => c.outfit.key)],
      avoidItemIds: others.flatMap((c) => c.outfit.items.map((item) => item.id)),
      count: 1,
      forgottenCards: before.forgotten ? 1 : 0,
    })).outfits;
    const undoDislike = { before, undo };
    // Never put the outfit she just turned down straight back on screen.
    if (next && next.key !== before.outfit.key) state.cards[i] = { ...newCard(next), undoDislike };
    else state.cards[i] = { outfit: null, undoDislike };
    changed();
    render();
  },
  undoDislike(i) {
    const { before, undo } = state.cards[i].undoDislike;
    undo();
    state.cards[i] = before;
    changed();
    render();
  },
  startRename() {
    state.renaming = true;
    render();
  },
  saveName(value) {
    const name = tidyName(value);
    state.data.settings.name = name === DEFAULT_NAME ? null : name;
    state.renaming = false;
    rememberName();
    changed();
    render();
  },
  cancelRename() {
    state.renaming = false;
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
    state.data = null; // the sign-in screen shows her own name, not the sample's
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
  rememberName();
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
    h('h1', {}, displayName()),
    h('p', { class: 'lead' }, 'Outfit ideas from the clothes in your OneDrive.'),
    state.signinNote && h('p', { class: 'hint', role: 'status' }, state.signinNote),
    h('button', { class: 'primary', disabled: !isConfigured(), onclick: onSignIn },
      remembered ? `Continue as ${remembered}` : 'Sign in with Microsoft'),
    !isConfigured() && h('p', { class: 'hint' }, 'Add your Microsoft app ID in js/config.js (see README).'),
    h('button', { class: 'secondary', onclick: enterSample }, 'Try with sample clothes')),
  h('footer', { class: 'version' }, VERSION_LINE));
}

function renderLoading() {
  append(root, h('section', { class: 'signin' },
    h('h1', {}, displayName()),
    h('p', { class: 'lead', role: 'status' }, 'Loading your wardrobe…')));
}

function renderError() {
  append(root, h('section', { class: 'signin' },
    h('h1', {}, displayName()),
    h('p', { class: 'lead', role: 'alert' },
      state.error.offline ? "You're offline. Connect to load your wardrobe." : "Couldn't reach OneDrive."),
    h('button', { class: 'primary', onclick: () => state.error.retry() }, 'Retry')));
}

function renderHomeScreen() {
  renderHome(root, {
    settings: state.data.settings,
    name: displayName(),
    renaming: state.renaming,
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
    style: styleSummary(learnHabits(state.data, todayISO())),
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
  document.title = displayName();
  clear(root);
  SCREENS[state.screen]();
}

// Switches screens. A new screen fades in; showing the same one again (the next piece to
// label) doesn't, and neither do taps that only redraw the screen (render).
function show(screen) {
  const isNew = screen !== state.screen;
  state.screen = screen;
  render();
  window.scrollTo(0, 0);
  if (isNew) fadeIn();
}

function fadeIn() {
  root.classList.remove('screen-in');
  void root.offsetWidth; // lets the animation start again
  root.classList.add('screen-in');
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
