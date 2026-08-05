import { verifyHmacSha256 } from "../_shared/razorpay.ts";

export interface VerifyPaymentInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifyPaymentDeps {
  getCallerUserId(): Promise<string | null>;
  findOrderByRazorpayOrderId(
    razorpayOrderId: string,
  ): Promise<{ id: string; userId: string } | null>;
  /** Inserts a dedup row. False if this exact event was already recorded. */
  recordEvent(params: {
    orderId: string;
    paymentId: string;
    source: "client";
    eventType: string;
  }): Promise<boolean>;
  /** The guarded UPDATE. False if the webhook had already stamped authority. */
  markPaid(orderId: string, paymentId: string): Promise<boolean>;
  keySecret: string;
}

export type VerifyPaymentResult =
  | { status: 200; body: { success: true } }
  | { status: 400 | 401 | 403 | 404; body: { error: string } };

/**
 * Handles the browser's post-payment callback.
 *
 * This is the OPTIMISTIC path. It exists purely so the customer sees "Order
 * placed!" without waiting for the webhook. It writes payment columns and
 * NOTHING else -- no stock, no order status (C3). If it turns out to be wrong,
 * the correction costs one column update and no inventory has moved.
 */
export async function handleVerifyPayment(
  deps: VerifyPaymentDeps,
  input: VerifyPaymentInput,
): Promise<VerifyPaymentResult> {
  const userId = await deps.getCallerUserId();
  if (!userId) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  if (!input.razorpayOrderId || !input.razorpayPaymentId || !input.razorpaySignature) {
    return { status: 400, body: { error: "Missing payment verification fields" } };
  }

  // Razorpay signs `order_id|payment_id` with the key secret. Anyone without
  // that secret cannot produce a matching digest, so this rejects fabricated
  // success claims before anything is written.
  const valid = await verifyHmacSha256(
    `${input.razorpayOrderId}|${input.razorpayPaymentId}`,
    input.razorpaySignature,
    deps.keySecret,
  );
  if (!valid) {
    console.error("[payment-verify] signature mismatch for", input.razorpayOrderId);
    return { status: 400, body: { error: "Invalid payment signature" } };
  }

  const order = await deps.findOrderByRazorpayOrderId(input.razorpayOrderId);
  if (!order) {
    return { status: 404, body: { error: "Order not found" } };
  }

  // A valid signature proves Razorpay produced the message. It does NOT prove
  // the caller owns the order -- without this check an authenticated customer
  // could submit someone else's razorpay order id.
  if (order.userId !== userId) {
    console.error("[payment-verify] ownership mismatch on", order.id);
    return { status: 403, body: { error: "Forbidden" } };
  }

  const isNew = await deps.recordEvent({
    orderId: order.id,
    paymentId: input.razorpayPaymentId,
    source: "client",
    eventType: "callback",
  });
  if (!isNew) {
    return { status: 200, body: { success: true } };
  }

  // May legitimately match zero rows if the webhook already decided (C2). That
  // is a success from the caller's perspective: the payment is recorded, just
  // by a more authoritative source.
  await deps.markPaid(order.id, input.razorpayPaymentId);

  return { status: 200, body: { success: true } };
}
