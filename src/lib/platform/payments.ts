import { Checkout } from 'capacitor-razorpay';
import { supabase } from '@/lib/supabase';
import { isNative } from '@/lib/platform';
import { isRazorpayCancellation } from '@/lib/platform/razorpay-error';

/**
 * capacitor-razorpay's shipped .d.ts does not describe what the plugin
 * actually does, so it is narrowed here rather than cast away at each call.
 *
 * The published types declare `open(options: { key, amount })` returning
 * `{ response: string }`. The Java implementation (Checkout.java) instead
 * forwards the WHOLE options object to Razorpay via `call.getData()` -- so
 * order_id, prefill, theme and currency are all supported -- and resolves
 * `{ response: <paymentData.getData() JSON object> }`, not a string.
 *
 * Typing it accurately here keeps the mismatch in one documented place; the
 * alternative is an `as unknown as` at the call site that silently hides any
 * future contract change.
 */
interface NativeCheckoutOptions {
  key: string;
  order_id: string;
  name?: string;
  description?: string;
  currency?: string;
  prefill?: { contact?: string; name?: string; email?: string };
  theme?: { color?: string };
}

const NativeCheckout = Checkout as unknown as {
  open(options: NativeCheckoutOptions): Promise<{ response?: RazorpayHandlerResponse }>;
};

const CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

export interface RazorpayCheckoutParams {
  razorpayOrderId: string;
  razorpayKeyId: string;
  customerPhone?: string;
}

/** The three fields payment-verify strictly requires. */
export interface RazorpayHandlerResponse {
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
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load the payment provider. Check your connection.'));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Tell the backend a payment landed.
 *
 * The optimistic path only. The webhook remains authoritative, so a failure
 * here is not fatal -- the order still resolves server-side. Both runtimes
 * surface success either way, which is why this never rejects.
 */
export async function notifyPaymentVerified(response: RazorpayHandlerResponse): Promise<void> {
  try {
    await supabase.functions.invoke('payment-verify', {
      body: {
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      },
    });
  } catch {
    // Deliberately swallowed -- see the doc comment.
  }
}

function openWebCheckout(params: RazorpayCheckoutParams): Promise<'paid' | 'dismissed'> {
  const { razorpayOrderId, razorpayKeyId, customerPhone } = params;

  return new Promise<'paid' | 'dismissed'>((resolve, reject) => {
    loadCheckoutScript()
      .then(() => {
        if (!window.Razorpay) {
          reject(new Error('Payment provider unavailable.'));
          return;
        }

        const rzp = new window.Razorpay({
          key: razorpayKeyId,
          order_id: razorpayOrderId,
          name: 'Freshlyn Nature',
          description: 'Order payment',
          prefill: customerPhone ? { contact: customerPhone } : undefined,
          theme: { color: '#16a34a' },
          handler: (response) => {
            notifyPaymentVerified(response).then(() => resolve('paid'));
          },
          modal: {
            // Customer closed the sheet. The order stays pending, holds no
            // stock, and is superseded on their next attempt.
            ondismiss: () => resolve('dismissed'),
          },
        });

        rzp.open();
      })
      .catch(reject);
  });
}

async function openNativeCheckout(
  params: RazorpayCheckoutParams,
): Promise<'paid' | 'dismissed'> {
  const { razorpayOrderId, razorpayKeyId, customerPhone } = params;

  try {
    const result = await NativeCheckout.open({
      key: razorpayKeyId,
      order_id: razorpayOrderId,
      name: 'Freshlyn Nature',
      description: 'Order payment',
      currency: 'INR',
      ...(customerPhone ? { prefill: { contact: customerPhone } } : {}),
      theme: { color: '#16a34a' },
    });

    // The plugin nests the payload one level deeper than the web handler's
    // shape. payment-verify strictly requires all three fields, so unwrap
    // before handing it over.
    const response = result.response;
    if (
      !response?.razorpay_order_id ||
      !response?.razorpay_payment_id ||
      !response?.razorpay_signature
    ) {
      throw new Error('Payment could not be confirmed. Please check your orders.');
    }

    // Same contract as web: the webhook is authoritative, so resolve "paid"
    // whatever payment-verify does.
    await notifyPaymentVerified(response);
    return 'paid';
  } catch (err) {
    // The Android SDK reports user dismissal as an *error* (code 2), not a
    // clean callback. Mapping it here is what produces the "Payment
    // cancelled -- your cart is saved" toast instead of a red error toast.
    if (isRazorpayCancellation(err)) return 'dismissed';
    throw err;
  }
}

/**
 * Open Razorpay checkout in whichever runtime we are in.
 *
 * Contract, identical on both sides:
 *   - payment succeeds -> resolve "paid" (regardless of payment-verify's
 *     outcome; the webhook is authoritative)
 *   - user cancels     -> resolve "dismissed"
 *   - genuine failure  -> reject, so Cart.tsx shows the error toast
 */
export async function openRazorpayCheckout(
  params: RazorpayCheckoutParams,
): Promise<'paid' | 'dismissed'> {
  if (isNative()) return openNativeCheckout(params);
  return openWebCheckout(params);
}
