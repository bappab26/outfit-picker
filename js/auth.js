// Microsoft sign-in with MSAL.js (loaded by index.html as the global `msal`). Browser only.
import { AUTHORITY, CLIENT_ID, HOME_SCREEN_SIGNIN, SCOPES, isAppId, redirectUri } from './config.js';
import { NeedsSignIn, Redirecting } from './errors.js';

let client = null;
let account = null;

export function isConfigured() {
  return isAppId(CLIENT_ID);
}

// False when the sign-in library couldn't load (usually: offline).
export function isLibraryLoaded() {
  return typeof globalThis.msal !== 'undefined';
}

function fromHomeScreen() {
  return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
}

const usePopup = () => HOME_SCREEN_SIGNIN === 'popup' && fromHomeScreen();

// Sets up sign-in once and finishes a sign-in that just came back from Microsoft.
// Returns the signed-in account, or null.
export async function initAuth() {
  if (client) return account;
  client = new globalThis.msal.PublicClientApplication({
    auth: { clientId: CLIENT_ID.trim(), authority: AUTHORITY, redirectUri: redirectUri() },
    cache: { cacheLocation: 'localStorage' },
  });
  await client.initialize();
  const result = await client.handleRedirectPromise();
  account = result?.account ?? client.getActiveAccount() ?? client.getAllAccounts()[0] ?? null;
  if (account) client.setActiveAccount(account);
  return account;
}

// The signed-in account's email, or null.
export function accountName() {
  return account?.username ?? null;
}

// Runs from a tap. With redirect, the page leaves for Microsoft and comes back to initAuth().
// `loginHint` fills in the account she used last time.
export async function signIn(loginHint) {
  await initAuth();
  const request = { scopes: SCOPES, ...(loginHint ? { loginHint } : {}) };
  if (usePopup()) {
    const result = await client.loginPopup(request);
    account = result.account;
    client.setActiveAccount(account);
    return;
  }
  await client.loginRedirect(request);
  throw new Redirecting();
}

export async function getToken() {
  try {
    return (await client.acquireTokenSilent({ scopes: SCOPES, account })).accessToken;
  } catch (e) {
    if (!(e instanceof globalThis.msal.InteractionRequiredAuthError)) throw e;
    // A popup can only open from a tap, so send her to the sign-in screen's button.
    if (usePopup()) throw new NeedsSignIn();
    await client.acquireTokenRedirect({ scopes: SCOPES, loginHint: account?.username });
    throw new Redirecting();
  }
}
