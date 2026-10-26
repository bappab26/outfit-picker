// Little hidden surprises (spec §2, "Easter eggs"): devil mode and the angel look, the secret
// card, rare cards, the 👎 nudge, her birthday, late nights, one year ago today and Wore this
// milestones. The rules live here; ui/eggs.js and ui/party.js show them.

export const EGGS = {
  // Taps on the version line that turn devil mode on or off, each at most tapGapMs after the
  // last; a countdown shows from the countdownFrom-th tap.
  devilTaps: 6,
  countdownFrom: 4,
  tapGapMs: 1500,
  // Holding the version line this long opens the secret card.
  holdMs: 800,
  // The chance that an outfit card is a rare find.
  rareChance: 1 / 150,
  // Turned-down outfits a never-liked, never-worn piece is in before the app asks about it.
  nudgeAfter: 5,
  // Her birthday, as MM-DD.
  birthday: '04-20',
  // "Go to sleep" shows from fromHour:00 until toHour:00.
  lateNight: { fromHour: 1, toHour: 5 },
};

export const BIRTHDAY_TEXT = 'Happy birthday! 🎂 Today every outfit is a 10.';

// The note on the secret card, scrambled so it can't be read at a glance or found by a search.
const NOTE = 'QnVpbHQgd2l0aCBsb3ZlIGFuZCB6ZXJvIGZhc2hpb24gc2Vuc2UgYnkgYmFwIGJhcCDwn5ak';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

// 'angel' when her name for the app has "angel" in it, else 'devil' in devil mode, else null.
export function eggTheme(name, devil) {
  if (/angel/i.test(name)) return 'angel';
  return devil ? 'devil' : null;
}

// One more tap on the version line at `now` (ms): { count, at }.
export function countTap(taps, now) {
  const count = taps && now - taps.at <= EGGS.tapGapMs ? taps.count + 1 : 1;
  return { count, at: now };
}

export function isRare(random = Math.random) {
  return random() < EGGS.rareChance;
}

export function isBirthday(today) {
  return today.slice(5) === EGGS.birthday;
}

export function isLateNight(date) {
  const hour = date.getHours();
  return hour >= EGGS.lateNight.fromHour && hour < EGGS.lateNight.toHour;
}

// The pieces of the last outfit she wore on this day a year ago that she still has, or null.
export function oneYearAgo(data, today) {
  const date = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const line = [...data.diary].reverse().find((l) => l.kind === 'wore' && l.date === date);
  const ids = line ? line.ids.filter((id) => data.items[id]) : [];
  return ids.length ? ids : null;
}

// After a 👎: a piece of that outfit that has been in nudgeAfter turned-down outfits and was
// never liked or worn, unless she already said Keep it (`kept`, a Set of ids). Else null.
export function nudgePiece(data, outfit, kept) {
  for (const { id } of outfit.items) {
    const item = data.items[id];
    if (!item || item.wearCount > 0 || kept.has(id)) continue;
    const lines = data.diary.filter((l) => l.ids.includes(id));
    if (lines.length >= EGGS.nudgeAfter && lines.every((l) => l.kind === 'dislike')) return id;
  }
  return null;
}

// Her 10th, 50th and 100th Wore this, then every 100th.
export function isMilestone(n) {
  return n === 10 || n === 50 || (n >= 100 && n % 100 === 0);
}

// The last milestone reached after `n` Wore this (0 before the first).
export function lastMilestone(n) {
  if (n >= 100) return n - (n % 100);
  if (n >= 50) return 50;
  return n >= 10 ? 10 : 0;
}

// After a Wore this: the milestone to celebrate, or null. Each one is celebrated once
// (`stats` is data.stats; its `celebrated` is updated).
export function celebrateMilestone(stats) {
  if (!isMilestone(stats.worn) || stats.worn <= stats.celebrated) return null;
  stats.celebrated = stats.worn;
  return stats.worn;
}

// What the secret card shows. Her favorite color is the one she wears most;
// '2000-01-01' stands for a piece added on an unknown day (store.js).
export function secretStats(data) {
  const items = Object.entries(data.items);
  let mostWorn = null;
  const wornByColor = {};
  for (const [id, item] of items) {
    if (item.wearCount > (mostWorn?.count ?? 0)) mostWorn = { id, count: item.wearCount };
    if (item.color && item.wearCount > 0) wornByColor[item.color] = (wornByColor[item.color] ?? 0) + item.wearCount;
  }
  const favoriteColor = Object.keys(wornByColor).sort((a, b) => wornByColor[b] - wornByColor[a])[0] ?? null;
  const since = items.map(([, item]) => item.addedAt).filter((d) => d > '2000-01-01').sort()[0] ?? null;
  return { pieces: items.length, worn: data.stats.worn, mostWorn, favoriteColor, since };
}

// '2026-10-25' → 'October 25, 2026'.
export function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function scramble(text) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

export function unscramble(code) {
  return new TextDecoder().decode(Uint8Array.from(atob(code), (c) => c.charCodeAt(0)));
}

export function secretNote() {
  return unscramble(NOTE);
}
