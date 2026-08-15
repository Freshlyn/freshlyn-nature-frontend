import { Preferences } from "@capacitor/preferences";
import { isNative } from "@/lib/platform";

/**
 * Session storage for supabase-js.
 *
 * Matches supabase-js's SupportedStorage shape. That interface already allows
 * promise-returning implementations, so the async native branch needs no
 * change in use-auth.tsx.
 *
 * Native uses Preferences (Android SharedPreferences) rather than WebView
 * localStorage: Android treats WebView storage as cache and wipes it on
 * "Clear cache" or under storage pressure, which logs users out at random.
 * SharedPreferences is app data and survives that. It is sandboxed but NOT
 * encrypted -- see the plan's Task 2 notes.
 *
 * Web returns localStorage unchanged, which is what the app and the E2E suite
 * already rely on.
 */
export const platformStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!isNative()) return localStorage.getItem(key);
    const { value } = await Preferences.get({ key });
    // Preferences resolves { value: null } when absent; normalise anything
    // falsy-but-not-empty-string to null so supabase-js sees "no session"
    // rather than a corrupt one.
    return value ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!isNative()) {
      localStorage.setItem(key, value);
      return;
    }
    await Preferences.set({ key, value });
  },

  async removeItem(key: string): Promise<void> {
    if (!isNative()) {
      localStorage.removeItem(key);
      return;
    }
    await Preferences.remove({ key });
  },
};
