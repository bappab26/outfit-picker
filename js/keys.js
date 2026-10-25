// Keys for remembering scores of piece pairs and whole outfits. Ids are
// sorted so the same pair or outfit always gets the same key.

export function pairKeys(ids) {
  const sorted = [...ids].sort();
  const keys = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) keys.push(`${sorted[i]}|${sorted[j]}`);
  }
  return keys;
}

export function outfitKey(ids) {
  return [...ids].sort().join('|');
}
