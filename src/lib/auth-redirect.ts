/**
 * Where to send a user once they finish logging in.
 *
 * Browsing is public and login is demanded at the moment of ACTION -- tapping
 * Add on a product, opening the cart, opening orders. Whoever makes that demand
 * records the page the user was on; the auth screen reads it back and returns
 * them there, so the interrupted action is one tap away instead of a fresh
 * navigation from Home.
 *
 * sessionStorage rather than localStorage: this is a single interrupted
 * journey, not a preference. A stale target surviving into tomorrow's session
 * would drop a user somewhere they never asked to go. Direct sessionStorage
 * rather than platformStorage because both writer and reader are synchronous
 * render paths, and on native the login flow lives in the same webview session.
 */
const KEY = "freshlyn.auth-redirect";

/** Never send a user back to an auth screen -- that is a redirect loop. */
const NEVER_RETURN_TO = ["/login", "/register"];

export function rememberAuthRedirect(path: string) {
  if (NEVER_RETURN_TO.includes(path)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Storage may be unavailable (private mode, embedded webview). The user
    // still logs in; they just land on Home.
  }
}

/**
 * Reads the pending target and clears it in one step, so a later login that
 * had no interrupted action cannot inherit this one's destination. Returns
 * null when there is nothing pending, which callers treat as "go to Home".
 */
export function takeAuthRedirect(): string | null {
  try {
    const stored = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return stored || null;
  } catch {
    return null;
  }
}

export function clearAuthRedirect() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // See above.
  }
}
