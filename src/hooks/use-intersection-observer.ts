import { useEffect, useRef } from "react";

interface Options {
  /** Called when the sentinel scrolls into view. */
  onIntersect: () => void;
  /** When false the observer stays detached (no more pages, or already fetching). */
  enabled?: boolean;
  /** Start fetching before the sentinel is actually visible. */
  rootMargin?: string;
}

/**
 * The nearest ancestor that actually scrolls, or null for the viewport.
 *
 * The app layout scrolls inside a `h-screen overflow-y-auto` wrapper rather
 * than the document, so an observer left on the default root measures against
 * a box that never moves and the sentinel never intersects. IntersectionObserver
 * requires the root to be an ANCESTOR of the observed element, so this walks up
 * from the target rather than guessing a selector.
 */
function scrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Fire a callback when the returned ref's element scrolls into view.
 *
 * The callback is held in a ref so that passing a fresh closure each render
 * does not tear down and re-create the observer -- re-observing an element
 * already on screen re-fires immediately, which would loop.
 */
export function useIntersectionObserver<T extends HTMLElement>({
  onIntersect,
  enabled = true,
  rootMargin = "200px",
}: Options) {
  const ref = useRef<T | null>(null);
  const callbackRef = useRef(onIntersect);

  useEffect(() => {
    callbackRef.current = onIntersect;
  }, [onIntersect]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    // Older Android webviews (Capacitor) may lack it; without this the page
    // would throw instead of simply not auto-loading.
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callbackRef.current();
      },
      { root: scrollParent(el), rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return ref;
}
