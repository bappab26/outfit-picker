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
  // With "Something different", a piece unworn for forgottenDays days (or never worn) gains forgottenBonus.
  forgottenDays: 30,
  forgottenBonus: 4,
  // Each outfit gets a random 0–randomMax extra points, so Shuffle gives new picks.
  randomMax: 1.5,
  // How long to wait after a change before saving to OneDrive.
  saveDelayMs: 1000,
};
