import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { isNative } from '@/lib/platform';
import { useToast } from '@/hooks/use-toast';

/** Routes where "back" means "leave the app" rather than "go up". */
const ROOT_ROUTES = ['/', '/orders', '/profile'];

/** How long the second press counts as confirming the exit. */
const EXIT_CONFIRM_WINDOW_MS = 2000;

/**
 * Give the Android hardware back button sensible behaviour.
 *
 * Without this Capacitor exits the app on every press, including with a
 * dialog open. Mount exactly once, in App.tsx. No-op on web.
 */
export function useAndroidBackButton(): void {
  const { toast } = useToast();
  const exitArmedAt = useRef<number>(0);

  useEffect(() => {
    if (!isNative()) return;

    const handlePromise = CapacitorApp.addListener('backButton', () => {
      // 1. A dialog is open -- close it and consume the press. Radix renders
      // open dialog content with data-state="open", so this finds any of them
      // without every dialog having to register itself.
      const openDialog = document.querySelector('[role="dialog"][data-state="open"]');
      if (openDialog) {
        // Radix closes on Escape, which also runs onOpenChange, so component
        // state stays in sync. Dispatching to the dialog node itself rather
        // than document keeps focus-scoped handlers working.
        openDialog.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
        return;
      }

      // 2. Not at a root -- go up. wouter 3.9 uses the real History API, so
      // this triggers a normal re-render of the route.
      if (!ROOT_ROUTES.includes(window.location.pathname)) {
        window.history.back();
        return;
      }

      // 3. At a root -- confirm before exiting, so a stray press does not
      // dump the user out of the app.
      const now = Date.now();
      if (now - exitArmedAt.current < EXIT_CONFIRM_WINDOW_MS) {
        void CapacitorApp.exitApp();
        return;
      }
      exitArmedAt.current = now;
      toast({
        title: 'Press back again to exit',
      });
    });

    return () => {
      // addListener resolves asynchronously; wait on the handle so a fast
      // unmount cannot leak the listener.
      void handlePromise.then((handle) => handle.remove());
    };
  }, [toast]);
}
