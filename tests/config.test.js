import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAppId } from '../js/config.js';

test('isAppId accepts a Microsoft application (client) ID', () => {
  assert.equal(isAppId('0fea44b6-712c-4aaa-9cf6-12a3a40cbb7f'), true);
  assert.equal(isAppId(' 0FEA44B6-712C-4AAA-9CF6-12A3A40CBB7F '), true);
});

test('isAppId rejects anything that is not one', () => {
  for (const value of ['PASTE-YOUR-APP-ID-HERE', '', '0fea44b6-712c-4aaa-9cf6', 'not an id', undefined]) {
    assert.equal(isAppId(value), false, String(value));
  }
});
