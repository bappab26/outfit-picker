import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glideFrom } from '../js/ui/glide.js';

test('the name starts where it was on the opening screen, at its size there', () => {
  const opening = { left: 16, top: 380, fontSize: 30 };
  const home = { left: 16, top: 16, fontSize: 22 };
  assert.equal(glideFrom(opening, home), 'translate(0px, 364px) scale(1.3636)');
});

test('a name already in place and at its size does not move', () => {
  const spot = { left: 16, top: 16, fontSize: 22 };
  assert.equal(glideFrom(spot, spot), 'translate(0px, 0px) scale(1)');
});
