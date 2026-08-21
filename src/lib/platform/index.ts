import { Capacitor } from "@capacitor/core";

/**
 * The single source of truth for which runtime we are in.
 *
 * Every module in this directory branches on this and nothing else, so there
 * is exactly one place to reason about when native and web diverge. Modules
 * outside this directory should not call it to pick an *implementation* --
 * that belongs behind a seam in here. Calling it to decide what to *render*
 * is fine: UI that only makes sense on a device has no behaviour to hide
 * behind a seam, it simply should not be on the page.
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}
