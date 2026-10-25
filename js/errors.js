// What the app does when talking to Microsoft fails (spec §5).
import { GraphError } from './onedrive.js';

// The page is leaving for Microsoft's sign-in page: nothing to show.
export class Redirecting extends Error {
  constructor() {
    super('redirecting');
    this.name = 'Redirecting';
  }
}

// She has to sign in again with a tap (a popup can only open from one).
export class NeedsSignIn extends Error {
  constructor() {
    super('sign-in needed');
    this.name = 'NeedsSignIn';
  }
}

// MSAL error codes that mean the request never got through.
const MSAL_NETWORK_CODES = ['no_network_connectivity', 'network_error', 'post_request_failed', 'get_request_failed', 'endpoints_resolution_error'];

// 'redirecting' | 'offline' | 'signin' (show the sign-in screen) | 'onedrive' (show Retry)
export function classifyError(error, { online = true } = {}) {
  if (error instanceof Redirecting) return 'redirecting';
  if (!online) return 'offline';
  if (error instanceof GraphError) {
    if (error.status === 0) return 'offline';
    return error.status === 401 ? 'signin' : 'onedrive';
  }
  if (error instanceof NeedsSignIn) return 'signin';
  // Any other MSAL error (timeouts, blocked popups, cancelled sign-in): Retry would fail the
  // same way, so she signs in again from the sign-in screen.
  if (typeof error?.errorCode === 'string') return MSAL_NETWORK_CODES.includes(error.errorCode) ? 'offline' : 'signin';
  return 'onedrive';
}
