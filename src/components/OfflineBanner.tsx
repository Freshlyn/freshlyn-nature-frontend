import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { getInitialNetworkStatus, subscribeToNetworkStatus } from "@/lib/platform/network";

/**
 * Makes a lost connection legible. Requests still fail and TanStack Query
 * still retries -- this only stops the failure being silent.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Optimistic initial value: assume online until proven otherwise, so the
    // banner never flashes during the first async status read.
    void getInitialNetworkStatus().then((status) => {
      if (!cancelled) setOnline(status);
    });
    const unsubscribe = subscribeToNetworkStatus(setOnline);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      className="fixed top-0 left-0 right-0 z-[60] pt-safe-t bg-destructive text-destructive-foreground"
      data-testid="offline-banner"
    >
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
        <WifiOff size={16} />
        <span>You&rsquo;re offline. Some things may not work.</span>
      </div>
    </div>
  );
}
