/**
 * Razorpay's user-cancelled code. The Android SDK reports dismissal as an
 * *error* (code 2, PAYMENT_CANCELED) rather than a clean ondismiss callback,
 * so the native branch has to recognise it and resolve "dismissed" instead of
 * rejecting. Anything else is a real failure.
 */
const PAYMENT_CANCELED = 2;

function extractCode(value: unknown): number | null {
  if (value === null || typeof value !== 'object') return null;
  const code = (value as { code?: unknown }).code;
  if (typeof code === 'number') return code;
  // The bridge sometimes stringifies the code; "2" and 2 mean the same thing.
  if (typeof code === 'string' && code.trim() !== '' && !Number.isNaN(Number(code))) {
    return Number(code);
  }
  return null;
}

/**
 * True only when the payload is confidently a user cancellation.
 *
 * Deliberately conservative: an unrecognised or unparseable payload returns
 * false, so it propagates as an error and the customer sees a real failure
 * message. The opposite bias would hide genuine payment failures behind a
 * friendly "your cart is saved" toast.
 */
export function isRazorpayCancellation(error: unknown): boolean {
  if (extractCode(error) === PAYMENT_CANCELED) return true;

  // capacitor-razorpay rejects with a stringified JSON blob on `message`.
  if (error !== null && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      try {
        if (extractCode(JSON.parse(message)) === PAYMENT_CANCELED) return true;
      } catch {
        // Not JSON -- fall through to false. See the doc comment above.
      }
    }
  }

  return false;
}
