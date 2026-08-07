import { Capacitor } from '@capacitor/core';

/**
 * The single source of truth for which runtime we are in.
 *
 * Every module in this directory branches on this and nothing else, so there
 * is exactly one place to reason about when native and web diverge. Consumers
 * outside this directory should not need to call it at all -- if they do, the
 * seam is leaking.
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}
