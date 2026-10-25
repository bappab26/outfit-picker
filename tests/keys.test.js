import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairKeys, outfitKey } from '../js/keys.js';

test('pairKeys lists each unordered pair once with sorted ids', () => {
  assert.deepEqual(pairKeys(['c', 'a', 'b']).sort(), ['a|b', 'a|c', 'b|c']);
  assert.deepEqual(pairKeys(['a']), []);
});

test('outfitKey does not depend on order', () => {
  assert.equal(outfitKey(['c', 'a', 'b']), 'a|b|c');
});
