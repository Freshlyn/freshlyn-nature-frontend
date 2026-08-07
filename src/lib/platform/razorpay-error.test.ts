import { describe, it, expect } from 'vitest';
import { isRazorpayCancellation } from './razorpay-error';

describe('isRazorpayCancellation', () => {
  it('detects a stringified JSON blob with code 2', () => {
    const err = { message: JSON.stringify({ code: 2, description: 'Payment processing cancelled by user' }) };
    expect(isRazorpayCancellation(err)).toBe(true);
  });

  it('detects a numeric code on the error object itself', () => {
    expect(isRazorpayCancellation({ code: 2 })).toBe(true);
  });

  it('detects a string-typed code, which the bridge sometimes produces', () => {
    expect(isRazorpayCancellation({ message: JSON.stringify({ code: '2' }) })).toBe(true);
  });

  it('detects the real payload capacitor-razorpay rejects with', () => {
    // Checkout.java's onPaymentError calls
    //   reject(paymentData.getData().getJSONObject("error").toString(), ...)
    // so `message` is the stringified Razorpay `error` object. Capacitor's
    // bridge surfaces that as an Error whose message is that JSON. This is the
    // shape a real user cancellation produces on-device.
    const nativeReject = new Error(
      JSON.stringify({
        code: 2,
        description: 'Payment processing cancelled by user',
        source: 'customer',
        step: 'payment_authentication',
        reason: 'payment_cancelled',
      }),
    );
    expect(isRazorpayCancellation(nativeReject)).toBe(true);
  });

  it('treats a genuine native payment failure as an error', () => {
    // Same envelope, but a real failure (BAD_REQUEST_ERROR) rather than a
    // dismissal -- must NOT be swallowed as "cart is saved".
    const failure = new Error(
      JSON.stringify({
        code: 'BAD_REQUEST_ERROR',
        description: 'Payment failed',
        reason: 'payment_failed',
      }),
    );
    expect(isRazorpayCancellation(failure)).toBe(false);
  });

  it('treats other Razorpay error codes as genuine failures', () => {
    // 0 = NETWORK_ERROR, 1 = INVALID_OPTIONS. Neither is a cancellation.
    expect(isRazorpayCancellation({ message: JSON.stringify({ code: 0 }) })).toBe(false);
    expect(isRazorpayCancellation({ message: JSON.stringify({ code: 1 }) })).toBe(false);
  });

  it('treats an unparseable payload as a genuine failure', () => {
    // Defensive: swallowing an unrecognised error as a dismissal would hide a
    // real payment failure behind a friendly "cart is saved" toast.
    expect(isRazorpayCancellation({ message: 'something went very wrong' })).toBe(false);
    expect(isRazorpayCancellation(new Error('boom'))).toBe(false);
    expect(isRazorpayCancellation(null)).toBe(false);
    expect(isRazorpayCancellation(undefined)).toBe(false);
    expect(isRazorpayCancellation('plain string')).toBe(false);
  });
});
