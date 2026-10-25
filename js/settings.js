// Every number the outfit rules use (spec §3). Change them here to tune the app.
export const SETTINGS = {
  // Outfits shown on the home screen.
  suggestions: 3,
  // An outfit with more different bold colors than this is never suggested.
  maxBoldColors: 2,
  // Points for each pair of pieces in an outfit, by how their colors go together.
  colorPoints: { neutral: 2, same: 1, adjacent: 1, opposite: 1, other: -2 },
  // Added to every pair in an outfit on 👍, 👎 and "Wore this"; dislikeOutfit goes to the exact outfit.
  taste: { like: 1, dislike: -1, wore: 0.5, dislikeOutfit: -5 },
  // A piece worn fewer than recentDays days ago loses recentPenalty points.
  recentDays: 3,
  recentPenalty: -3,
  // A piece unworn for forgottenDays days (or never worn) is forgotten. One outfit in three has one
  // when possible, picked with forgottenBonus added for each forgotten piece.
  forgottenDays: 30,
  forgottenBonus: 4,
  // Each outfit gets a random 0–randomMax extra points, so Shuffle gives new picks.
  randomMax: 1.5,
  // Learning her habits from the diary of "Wore this", 👍 and 👎 (spec §3.6).
  habits: {
    // The diary keeps this many of her latest choices.
    diaryMax: 500,
    // A choice this many days old counts half as much as one made today.
    halfLifeDays: 60,
    // How slowly a habit is learned: a habit's score is (yes − no) / (yes + no + prior).
    prior: 4,
    // The most points each habit can add to or take from an outfit.
    points: { colorPairs: 2, colors: 1, shape: 2, dressedUp: 1 },
    // "Your style so far" shows after this many choices, listing habits scoring at least strongAt.
    showAfter: 5,
    strongAt: 0.3,
  },
  // How long to wait after a change before saving to OneDrive.
  saveDelayMs: 1000,
};
