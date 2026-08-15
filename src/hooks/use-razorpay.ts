import { useCallback } from "react";
import { openRazorpayCheckout, type RazorpayCheckoutParams } from "@/lib/platform/payments";

export type { RazorpayCheckoutParams };

/**
 * Thin wrapper over the platform payments adapter. The public signature is
 * deliberately unchanged, so Cart.tsx does not care which runtime it is in.
 */
export function useRazorpay() {
  const openCheckout = useCallback(
    (params: RazorpayCheckoutParams) => openRazorpayCheckout(params),
    [],
  );

  return { openCheckout };
}
