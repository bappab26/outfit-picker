import { test } from 'node:test';
import assert from 'node:assert/strict';
import { control, isDisabled, newRoot } from './fake-dom.js';
import { renderShop } from '../js/ui/shop.js';

const actions = new Proxy({}, { get: () => () => {} });
const check = (extra = {}) => ({ photo: 'blob:photo', color: 'red', category: 'tops', style: 'smart', warmth: 'medium', wishId: null, ...extra });
const view = (extra = {}) => ({
  check: null, result: null, wishlist: [], canWishlist: true, hasLabeled: true,
  photoUrl: () => 'https://thumbs.example/x', busy: null, note: null, confirmRemove: false, ...extra,
});
const draw = (v) => {
  const root = newRoot();
  renderShop(root, v, actions);
  return root;
};

test('while a check is saving, nothing on screen can end it or start another', () => {
  const root = draw(view({ check: check(), result: { count: 3, best: [] }, busy: 'Saving…' }));
  for (const text of ['Save to wishlist', 'Done', 'Retake photo']) assert.ok(isDisabled(control(root, text)), text);
  assert.ok(root.textContent.includes('Saving…'));
});

test('while a wishlist item is moving or being removed, its buttons wait', () => {
  const root = draw(view({ check: check({ wishId: 'w1', photo: 'https://big.example/w1' }), result: { count: 3, best: [] }, busy: 'Moving…' }));
  for (const text of ['I bought it', 'Remove', 'Done']) assert.ok(isDisabled(control(root, text)), text);
});

test('the start screen shows what OneDrive is busy with, and its note, and waits to check a piece', () => {
  const busy = draw(view({ busy: 'Saving…' }));
  assert.ok(isDisabled(control(busy, '🛍️ Check a piece')));
  assert.ok(busy.textContent.includes('Saving…'));
  const failed = draw(view({ note: "You're offline. Connect and try again." }));
  assert.ok(failed.textContent.includes("You're offline. Connect and try again."));
  assert.ok(!isDisabled(control(failed, '🛍️ Check a piece')));
});

test('when nothing is busy, everything can be used', () => {
  const root = draw(view({ check: check(), result: { count: 3, best: [] } }));
  for (const text of ['Save to wishlist', 'Done', 'Retake photo']) assert.ok(!isDisabled(control(root, text)), text);
});
