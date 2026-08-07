import { Network } from '@capacitor/network';
import { isNative } from '@/lib/platform';

/**
 * Current connectivity, once.
 *
 * navigator.onLine is famously optimistic on the web -- it reports "online"
 * for a connected-but-useless network. That is acceptable here: this drives a
 * banner, not retry logic, and TanStack Query already owns retries.
 */
export async function getInitialNetworkStatus(): Promise<boolean> {
  if (isNative()) {
    const status = await Network.getStatus();
    return status.connected;
  }
  return navigator.onLine;
}

/**
 * Subscribe to connectivity changes. Returns an unsubscribe function that is
 * safe to call from a React effect cleanup in either runtime.
 */
export function subscribeToNetworkStatus(listener: (online: boolean) => void): () => void {
  if (isNative()) {
    // addListener resolves to the handle asynchronously, so cleanup has to
    // wait on that promise rather than assume a handle already exists --
    // otherwise a fast unmount leaks the listener.
    const handlePromise = Network.addListener('networkStatusChange', (status) =>
      listener(status.connected),
    );
    return () => {
      void handlePromise.then((handle) => handle.remove());
    };
  }

  const onOnline = () => listener(true);
  const onOffline = () => listener(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
