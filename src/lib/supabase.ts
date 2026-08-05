import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

/**
 * The localStorage key supabase-js persists the session under, e.g.
 * "sb-qwtthzmojxxenrgznswl-auth-token". Derived from the project ref in the
 * URL rather than hardcoded so it stays correct across environments (local,
 * staging, prod), which each have a different ref and therefore a different key.
 */
export function authStorageKey(): string | null {
  try {
    const { hostname } = new URL(import.meta.env.VITE_SUPABASE_URL);
    // Hosted projects key off the project ref (the first label of
    // <ref>.supabase.co). A local stack runs on an IP/bare host, where
    // supabase-js uses the whole hostname — so only strip the subdomain when
    // there actually is one to strip.
    const ref = hostname.endsWith('.supabase.co') ? hostname.split('.')[0] : hostname;
    return ref ? `sb-${ref}-auth-token` : null;
  } catch {
    return null;
  }
}

/**
 * Drop the persisted session without calling the auth server.
 *
 * signOut() is the normal path, but it POSTs /logout with the current token —
 * and when the underlying auth user has been deleted that call can fail,
 * leaving the stale token in localStorage and the user stuck in a broken
 * half-signed-in state. Removing the key directly always succeeds.
 */
export function clearStoredSession(): void {
  const key = authStorageKey();
  if (key) localStorage.removeItem(key);
}
