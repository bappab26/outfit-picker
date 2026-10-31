// Starts the app, holds its state and switches between screens.
import { accountName, getToken, initAuth, isConfigured, isLibraryLoaded, signIn } from './auth.js';
import { detectImageColor } from './colors.js';
import { todayISO } from './dates.js';
import { EGGS, celebrateMilestone, countTap, eggTheme, isBirthday, isLateNight, isRare, nudgePiece, oneYearAgo, secretStats } from './eggs.js';
import { classifyError } from './errors.js';
import { dislike, like, woreThis } from './feedback.js';
import { learnHabits, styleSummary } from './habits.js';
import { createGraph, GraphError } from './onedrive.js';
import { photoFileName, shrinkPhoto } from './photos.js';
import { pickOutfits } from './rules.js';
import { createOneDriveSource, createSampleSource } from './sources.js';
import { allItems, createSaver, labeledItems, tidyName, unlabeledIds } from './store.js';
import { append, clear, h } from './ui/dom.js';
import { versionLine } from './ui/eggs.js';
import { renderHome } from './ui/home.js';
import { INTRO_MAX_MS, pickIntro, playIntro, spotOf } from './ui/intro.js';
import { renderLabel } from './ui/label.js';
import { DEFAULT_NAME, VERSION_LINE } from './ui/labels.js';
import { confetti, toast } from './ui/party.js';
import { renderStats } from './ui/stats.js';
import { renderWardrobe } from './ui/wardrobe.js';
import { renderWorn } from './ui/worn.js';
import { addMonths, firstMonth, lastWornDay, outfitsOn, wornDays } from './worn.js';
import { wardrobeStats } from './stats.js';

const MODE_KEY = 'outfit-picker:mode';
// The email she signed in with, so being signed out (Microsoft's sign-in library forgets her
// after a restart unless she chose "Stay signed in") takes one tap to undo.
const ACCOUNT_KEY = 'outfit-picker:account';
// Her name for the app, so the sign-in screen shows it before her data has loaded.
const NAME_KEY = 'outfit-picker:name';
// Easter eggs (eggs.js): evil mode ('on'), the pieces she told "Keep it" (a JSON list), the
// year her birthday card last showed and the day she hid "One year ago today". Evil mode's key
// keeps its first name, devil mode, so phones that have it on keep it on.
const EVIL_KEY = 'outfit-picker:devil';
const KEPT_KEY = 'outfit-picker:kept';
const BIRTHDAY_KEY = 'outfit-picker:birthday';
const MEMORY_KEY = 'outfit-picker:memory-hidden';
// The last opening animation (ui/intro.js), so the next one is different.
const INTRO_KEY = 'outfit-picker:intro';
const root = document.getElementById('app');
// Where render() draws the current screen, above the version line.
let screenRoot = root;

// No pinch zoom: iPhones ignore the page's zoom setting, so the gesture itself is stopped.
document.addEventListener('gesturestart', (event) => event.preventDefault());

// Esc closes the big outfit, the secret card or the birthday card (on a computer).
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (state.screen === 'worn' && state.worn.zoomed !== null) calendarActions.closeZoom();
  if (state.screen !== 'home') return;
  if (state.secretOpen) homeActions.closeSecret();
  else if (state.birthdayOpen) homeActions.closeBirthday();
  else if (state.zoomed !== null) homeActions.closeZoom();
});

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
  // The piece shown big (its id), or null; `zoomOpening` makes it zoom in only as it opens.
  zoomed: null,
  zoomOpening: false,
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
  // Wardrobe and labeling screens: picking a folder to add photos to, asking "Delete this
  // piece?", what OneDrive is busy doing ("Adding 3 photos…"), and a note when that failed.
  adding: false,
  confirmDelete: false,
  busy: null,
  note: null,
  // Outfit calendar: the month shown ('YYYY-MM'), the day picked and the outfit of that day
  // shown big (its index), or null.
  worn: { month: null, day: null, zoomed: null },
  // Easter eggs: evil mode, the quick taps on the version line so far, and whether the
  // secret card or the birthday card is open.
  evil: storage.getItem(EVIL_KEY) === 'on',
  taps: null,
  secretOpen: false,
  birthdayOpen: false,
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
// `undoDislike` brings back the outfit this card replaced. `rare` makes it a rare find, and
// `nudge` is a piece to ask her about after a 👎.
function newCard(outfit) {
  return {
    outfit, forgotten: Boolean(outfit.forgotten), rare: isRare(), nudge: null,
    liked: false, worn: false, undoLike: null, undoWore: null, undoDislike: null,
  };
}

function keptPieces() {
  try {
    const kept = JSON.parse(storage.getItem(KEPT_KEY) ?? '[]');
    return new Set(Array.isArray(kept) ? kept : []);
  } catch {
    return new Set();
  }
}

// She won't be asked about this piece again.
function keepPiece(id) {
  storage.setItem(KEPT_KEY, JSON.stringify([...keptPieces(), id]));
}

function recompute(extra) {
  const { outfits, notes } = pickOutfits(labeledItems(state.data), state.data, pickOptions(extra));
  state.cards = outfits.map(newCard);
  state.notes = notes;
  state.zoomed = null;
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
    const milestone = c.worn && celebrateMilestone(state.data.stats);
    if (milestone) {
      toast(`${milestone} outfits worn! 😈`, 3500);
      confetti();
    }
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
    const nudge = nudgePiece(state.data, before.outfit, keptPieces());
    // Never put the outfit she just turned down straight back on screen.
    if (next && next.key !== before.outfit.key) state.cards[i] = { ...newCard(next), undoDislike, nudge };
    else state.cards[i] = { outfit: null, undoDislike, nudge };
    state.zoomed = null; // the cards changed under it
    changed();
    render();
  },
  zoom(id) {
    state.zoomed = id;
    state.zoomOpening = true;
    render();
  },
  closeZoom() {
    state.zoomed = null;
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
  addClothes() {
    show('wardrobe');
    state.adding = true;
    render();
  },
  async exitSample() {
    await state.saver.flush();
    storage.removeItem(MODE_KEY);
    state.data = null; // the sign-in screen shows her own name, not the sample's
    show('signin');
  },
  // Easter eggs
  tapVersion() {
    state.taps = countTap(state.taps, Date.now());
    const left = EGGS.evilTaps - state.taps.count;
    if (left > 0) {
      if (state.taps.count >= EGGS.countdownFrom) toast(`${left}…`, 1200);
      return;
    }
    state.taps = null;
    if (eggTheme(displayName(), false) === 'angel') {
      toast("Angels can't go evil 😇");
      return;
    }
    state.evil = !state.evil;
    if (state.evil) storage.setItem(EVIL_KEY, 'on');
    else storage.removeItem(EVIL_KEY);
    toast(state.evil ? 'Evil mode on 😈' : 'Evil mode off');
    render();
  },
  openSecret() {
    state.secretOpen = true;
    render();
  },
  closeSecret() {
    state.secretOpen = false;
    render();
  },
  closeBirthday() {
    state.birthdayOpen = false;
    render();
  },
  hideMemory() {
    storage.setItem(MEMORY_KEY, todayISO());
    render();
  },
  keepPiece(i) {
    keepPiece(state.cards[i].nudge);
    state.cards[i].nudge = null;
    render();
  },
  lookAtPiece(i) {
    const id = state.cards[i].nudge;
    keepPiece(id);
    state.cards[i].nudge = null;
    wardrobeActions.edit(id);
  },
};

// The first time she opens the app on her birthday each year: confetti and a card.
// Called once the name's opening animation is over, and only if she's still on the home screen.
function birthdaySurprise() {
  const today = todayISO();
  const year = today.slice(0, 4);
  if (state.screen !== 'home' || !isBirthday(today) || storage.getItem(BIRTHDAY_KEY) === year) return;
  storage.setItem(BIRTHDAY_KEY, year);
  state.birthdayOpen = true;
  render();
  confetti(140);
}

// "One year ago today": the pieces, unless she hid it today.
function memoryIds() {
  const today = todayISO();
  return storage.getItem(MEMORY_KEY) === today ? null : oneYearAgo(state.data, today);
}

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

// A change from a button that talks to OneDrive, showing `text` while it runs. Sign-in problems
// go to the sign-in screen, as in run(); other failures leave a note on the same screen.
// True if it worked.
async function busyChange(text, step) {
  state.busy = text;
  state.note = null;
  render();
  try {
    await step();
    return true;
  } catch (e) {
    const kind = classifyError(e, { online: navigator.onLine !== false });
    if (kind === 'signin') {
      state.signinNote = 'Please sign in again.';
      show('signin');
    } else if (kind !== 'redirecting') {
      state.note = kind === 'offline' ? "You're offline. Connect and try again." : "OneDrive didn't answer. Try again in a moment.";
    }
    return false;
  } finally {
    state.busy = null;
  }
}

const labelActions = {
  setColor: (color) => setLabel('color', color),
  setWarmth: (warmth) => setLabel('warmth', warmth),
  setStyle: (style) => setLabel('style', style),
  skip: nextPiece,
  done: () => show('wardrobe'),
  back: () => (state.label.mode === 'new' ? goHome() : show('wardrobe')),
  async move(category) {
    const id = labelId();
    if (state.busy || state.data.items[id].category === category) return;
    if (await busyChange('Moving…', () => state.source.movePiece(state.data, id, category))) changed();
    if (state.screen === 'label') render();
  },
  askDelete() {
    state.confirmDelete = true;
    render();
    root.querySelector('.confirm')?.scrollIntoView({ block: 'nearest' });
  },
  cancelDelete() {
    state.confirmDelete = false;
    render();
  },
  async confirmDelete() {
    const id = labelId();
    if (state.busy) return;
    if (await busyChange('Deleting…', () => state.source.deletePiece(state.data, id))) {
      changed();
      show('wardrobe');
    } else if (state.screen === 'label') {
      state.confirmDelete = false;
      render();
    }
  },
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
  startAdding() {
    state.adding = true;
    state.note = null;
    render();
  },
  cancelAdding() {
    state.adding = false;
    render();
  },
  async addPhotos(category, files) {
    if (!files.length || state.busy) return;
    state.adding = false;
    const n = files.length;
    let result = { newIds: [], failed: n };
    await busyChange(n === 1 ? 'Adding 1 photo…' : `Adding ${n} photos…`, async () => {
      result = await state.source.addPhotos(state.data, category, files);
    });
    changed(); // even after a failure, the photos sent before it are in OneDrive and in the data
    if (state.screen !== 'wardrobe') return;
    if (result.failed && !state.note) {
      state.note = result.newIds.length
        ? `Added ${result.newIds.length} of ${n} photos. Check your connection and try again for the rest.`
        : "Couldn't add the photos. Check your connection and try again.";
    }
    if (state.note || !result.newIds.length) {
      render();
      return;
    }
    // Straight on to labeling the new pieces.
    state.label = { mode: 'new', queue: result.newIds, index: 0, id: null };
    show('label');
  },
  // Opens on her latest Wore this, or this month if there is none.
  openCalendar() {
    const today = todayISO();
    showMonth((lastWornDay(state.data, today) ?? today).slice(0, 7));
    show('worn');
  },
  openStats() {
    show('stats');
  },
};

const statsActions = {
  back: () => show('wardrobe'),
};

// ----- Outfit calendar -----

// Shows `month` with its latest Wore this picked.
function showMonth(month) {
  state.worn = { month, day: lastWornDay(state.data, todayISO(), month), zoomed: null };
}

const calendarActions = {
  back: () => show('wardrobe'),
  prevMonth() {
    showMonth(addMonths(state.worn.month, -1));
    render();
  },
  nextMonth() {
    showMonth(addMonths(state.worn.month, 1));
    render();
  },
  pickDay(day) {
    state.worn = { ...state.worn, day, zoomed: null };
    render();
  },
  zoom(i) {
    state.worn.zoomed = i;
    state.zoomOpening = true;
    render();
  },
  closeZoom() {
    state.worn.zoomed = null;
    render();
  },
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
  setTimeout(birthdaySurprise, INTRO_MAX_MS + 100); // redrawing the screen sooner would cut the name's animation short
}

async function enterSample() {
  storage.setItem(MODE_KEY, 'sample');
  await openWardrobeData(createSampleSource({ storage, today: todayISO() }));
}

async function enterOneDrive() {
  show('loading');
  const graph = createGraph({ getToken });
  const detect = async (entry) => detectImageColor(await graph.fetchImageBlob(entry));
  const photos = {
    shrink: shrinkPhoto,
    color: detectImageColor,
    url: (blob) => URL.createObjectURL(blob),
    name: (n) => photoFileName(new Date(), n),
  };
  await openWardrobeData(createOneDriveSource({ graph, detect, storage, today: todayISO(), photos }));
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
  append(screenRoot, h('section', { class: 'signin' },
    h('h1', {}, displayName()),
    h('p', { class: 'lead' }, 'Outfit ideas from the clothes in your OneDrive.'),
    state.signinNote && h('p', { class: 'hint', role: 'status' }, state.signinNote),
    h('button', { class: 'primary', disabled: !isConfigured(), onclick: onSignIn },
      remembered ? `Continue as ${remembered}` : 'Sign in with Microsoft'),
    !isConfigured() && h('p', { class: 'hint' }, 'Add your Microsoft app ID in js/config.js (see README).'),
    h('button', { class: 'secondary', onclick: enterSample }, 'Try with sample clothes')));
}

function renderLoading() {
  append(screenRoot, h('section', { class: 'signin' },
    h('h1', {}, displayName()),
    h('p', { class: 'lead', role: 'status' }, 'Loading your wardrobe…')));
}

function renderError() {
  append(screenRoot, h('section', { class: 'signin' },
    h('h1', {}, displayName()),
    h('p', { class: 'lead', role: 'alert' },
      state.error.offline ? "You're offline. Connect to load your wardrobe." : "Couldn't reach OneDrive."),
    h('button', { class: 'primary', onclick: () => state.error.retry() }, 'Retry')));
}

function takeZoomOpening() {
  const opening = state.zoomOpening;
  state.zoomOpening = false;
  return opening;
}

function renderHomeScreen() {
  renderHome(screenRoot, {
    settings: state.data.settings,
    zoomed: state.zoomed,
    zoomOpening: takeZoomOpening(),
    name: displayName(),
    renaming: state.renaming,
    cards: state.cards,
    notes: state.notes,
    newCount: unlabeledIds(state.data).length,
    photoUrl: (id) => state.source.photoUrl(id),
    bigPhotoUrl: (id) => state.source.bigPhotoUrl(id),
    fileName: (id) => state.data.items[id]?.fileName ?? '',
    sampleMode: state.source.mode === 'sample',
    saveError: state.saveError,
    hasLabeled: labeledItems(state.data).length > 0,
    canAdd: state.source.canAdd,
    lateNight: isLateNight(new Date()),
    memory: memoryIds(),
    secret: state.secretOpen ? secretStats(state.data) : null,
    birthday: state.birthdayOpen,
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
  renderLabel(screenRoot, {
    item: { id, ...state.data.items[id] },
    photoUrl: state.source.photoUrl(id),
    bigPhotoUrl: state.source.bigPhotoUrl(id),
    mode: state.label.mode,
    remaining: state.label.queue.length - state.label.index,
    sampleMode: state.source.mode === 'sample',
    confirmDelete: state.confirmDelete,
    busy: state.busy,
    note: state.note,
  }, labelActions);
}

function renderWardrobeScreen() {
  renderWardrobe(screenRoot, {
    items: allItems(state.data),
    photoUrl: (id) => state.source.photoUrl(id),
    canRefresh: state.source.mode === 'onedrive',
    refreshing: state.refreshing,
    style: styleSummary(learnHabits(state.data, todayISO())),
    canAdd: state.source.canAdd,
    adding: state.adding,
    busy: state.busy,
    note: state.note,
  }, wardrobeActions);
}

function renderWornScreen() {
  const today = todayISO();
  const { month, day, zoomed } = state.worn;
  const first = firstMonth(state.data);
  renderWorn(screenRoot, {
    month,
    day,
    zoomed,
    zoomOpening: takeZoomOpening(),
    today,
    wornDays: wornDays(state.data, month),
    outfits: day ? outfitsOn(state.data, day) : [],
    hasAny: Boolean(first),
    canGoBack: Boolean(first) && month > first,
    canGoForward: month < today.slice(0, 7),
    photoUrl: (id) => state.source.photoUrl(id),
    bigPhotoUrl: (id) => state.source.bigPhotoUrl(id),
    fileName: (id) => state.data.items[id]?.fileName ?? '',
  }, calendarActions);
}

function renderStatsScreen() {
  renderStats(screenRoot, {
    stats: wardrobeStats(state.data, todayISO()),
    photoUrl: (id) => state.source.photoUrl(id),
    fileName: (id) => state.data.items[id]?.fileName ?? '',
  }, statsActions);
}

// The opening screens stay clean: just the name and what to do.
const NO_VERSION_LINE = ['signin', 'loading', 'error'];

const SCREENS = {
  signin: renderSignIn,
  loading: renderLoading,
  error: renderError,
  home: renderHomeScreen,
  label: renderLabelScreen,
  wardrobe: renderWardrobeScreen,
  worn: renderWornScreen,
  stats: renderStatsScreen,
};

// Evil mode or the angel look (eggs.js) colors every screen, and the phone's top bar.
function applyTheme() {
  const theme = eggTheme(displayName(), state.evil);
  document.body.classList.toggle('evil', theme === 'evil');
  document.body.classList.toggle('angel', theme === 'angel');
  const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

function render() {
  document.title = displayName();
  applyTheme();
  // A tap inside the big outfit redraws it: keep it scrolled where it was.
  const zoomScroll = root.querySelector('.zoom-panel')?.scrollTop ?? 0;
  clear(root);
  const content = h('div', { class: 'screen' });
  root.append(content);
  screenRoot = content;
  SCREENS[state.screen]();
  if (screenRoot !== content) return; // the screen changed and was drawn again (renderLabelScreen)
  // The version line, at the bottom of every screen but the opening ones; on the home screen
  // it hides evil mode and the secret card (ui/eggs.js).
  if (state.screen === 'home') root.append(versionLine(homeActions));
  else if (!NO_VERSION_LINE.includes(state.screen)) root.append(h('footer', { class: 'version' }, VERSION_LINE));
  const panel = root.querySelector('.zoom-panel');
  if (panel) panel.scrollTop = zoomScroll;
  // The page behind the big outfit stays still.
  document.body.classList.toggle('no-scroll', Boolean(panel));
}

// Switches screens. A new screen fades in; showing the same one again (the next piece to
// label) doesn't, and neither do taps that only redraw the screen (render). From the opening
// screen (sign-in or loading) to the home screen, the name moves up to its place instead.
function show(screen) {
  const isNew = screen !== state.screen;
  const openingTitle = isNew && screen === 'home' && root.querySelector('.signin h1');
  const from = openingTitle && spotOf(openingTitle);
  if (isNew) Object.assign(state, { adding: false, confirmDelete: false, note: null, zoomed: null, secretOpen: false, birthdayOpen: false });
  state.screen = screen;
  render();
  window.scrollTo(0, 0);
  if (isNew && !(from && openingAnimation(from))) fadeIn();
}

// One of the opening animations, a different one from last time. False if it can't play.
function openingAnimation(from) {
  const name = pickIntro(storage.getItem(INTRO_KEY));
  if (!playIntro(root, from, name)) return false;
  storage.setItem(INTRO_KEY, name);
  return true;
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
