import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyError, NeedsSignIn, Redirecting } from '../js/errors.js';
import { GraphError } from '../js/onedrive.js';

// MSAL errors carry a string errorCode.
const msalError = (errorCode) => Object.assign(new Error(errorCode), { name: 'BrowserAuthError', errorCode });

test('leaving for Microsoft sign-in needs nothing', () => {
  assert.equal(classifyError(new Redirecting()), 'redirecting');
});

test('no connection shows the offline message', () => {
  assert.equal(classifyError(new GraphError(0, 'Failed to fetch')), 'offline');
  assert.equal(classifyError(new GraphError(500, 'boom'), { online: false }), 'offline');
  assert.equal(classifyError(msalError('no_network_connectivity')), 'offline');
});

test('sign-in problems go back to the sign-in screen instead of a Retry loop', () => {
  assert.equal(classifyError(msalError('monitor_window_timeout')), 'signin');
  assert.equal(classifyError(msalError('popup_window_error')), 'signin');
  assert.equal(classifyError(msalError('user_cancelled')), 'signin');
  assert.equal(classifyError(new NeedsSignIn()), 'signin');
  assert.equal(classifyError(new GraphError(401, 'expired')), 'signin');
});

test('other OneDrive failures offer Retry', () => {
  assert.equal(classifyError(new GraphError(500, 'boom')), 'onedrive');
  assert.equal(classifyError(new GraphError(429, 'slow down')), 'onedrive');
  assert.equal(classifyError(new TypeError('x is undefined')), 'onedrive');
});
