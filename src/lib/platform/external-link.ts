import { isNative } from '@/lib/platform';

/**
 * Open an http(s) URL outside the app.
 *
 * The two runtimes need opposite calls, which is why this is an adapter rather
 * than an `<a target="_blank">` in the markup:
 *
 * - Native: a plain navigation. Capacitor's `Bridge.launchIntent` compares the
 *   URL's host+scheme against the app origin (https://localhost) and the
 *   `allowNavigation` config; anything else is fired as an ACTION_VIEW intent,
 *   so the system browser takes it and our WebView never actually unloads.
 *   `target="_blank"` and `window.open` must NOT be used here -- Android's
 *   WebView discards new-window navigations unless `setSupportMultipleWindows`
 *   is on and `onCreateWindow` is implemented, and Capacitor ships neither, so
 *   the tap silently does nothing and `shouldOverrideUrlLoading` never fires.
 *
 * - Web: a new tab, so the user does not lose their place in the app.
 */
export function openExternalUrl(url: string): void {
  if (isNative()) {
    window.location.href = url;
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
