import { useCallback } from "react";
import { supabase } from "@/lib/supabase";

const CHECKOUT_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { contact?: string; name?: string };
  theme?: { color?: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

/** Loads Razorpay's checkout script once and caches the in-flight promise. */
let scriptPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load the payment provider. Check your connection."));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export interface RazorpayCheckoutParams {
  razorpayOrderId: string;
  razorpayKeyId: string;
  customerPhone?: string;
}

export function useRazorpay() {
  const openCheckout = useCallback(
    ({ razorpayOrderId, razorpayKeyId, customerPhone }: RazorpayCheckoutParams) =>
      new Promise<"paid" | "dismissed">((resolve, reject) => {
        loadCheckoutScript()
          .then(() => {
            if (!window.Razorpay) {
              reject(new Error("Payment provider unavailable."));
              return;
            }

            const rzp = new window.Razorpay({
              key: razorpayKeyId,
              order_id: razorpayOrderId,
              name: "Freshlyn Nature",
              description: "Order payment",
              prefill: customerPhone ? { contact: customerPhone } : undefined,
              theme: { color: "#16a34a" },
              handler: (response) => {
                // The optimistic path. The webhook remains authoritative, so a
                // failure here is not fatal -- the order still resolves
                // server-side. Surface success either way.
                supabase.functions
                  .invoke("payment-verify", {
                    body: {
                      razorpayOrderId: response.razorpay_order_id,
                      razorpayPaymentId: response.razorpay_payment_id,
                      razorpaySignature: response.razorpay_signature,
                    },
                  })
                  .then(() => resolve("paid"))
                  .catch(() => resolve("paid"));
              },
              modal: {
                // Customer closed the sheet. The order stays pending, holds no
                // stock, and is superseded on their next attempt.
                ondismiss: () => resolve("dismissed"),
              },
            });

            rzp.open();
          })
          .catch(reject);
      }),
    [],
  );

  return { openCheckout };
}
