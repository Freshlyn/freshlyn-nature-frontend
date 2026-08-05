import { verifyHmacSha256 } from "../_shared/razorpay.ts";

export interface WebhookDeps {
  findOrderByRazorpayOrderId(razorpayOrderId: string): Promise<{ id: string } | null>;
  /** Inserts a dedup row. False if this exact event was already recorded. */
  recordEvent(params: {
    orderId: string;
    paymentId: string;
    source: "webhook";
    eventType: string;
  }): Promise<boolean>;
  confirmPayment(orderId: string, paymentId: string): Promise<void>;
  failPayment(orderId: string, paymentId: string): Promise<void>;
  webhookSecret: string;
}

export type WebhookResult =
  | { status: 200; body: { received: true } }
  | { status: 400 | 401; body: { error: string } };

/**
 * The authoritative payment path.
 *
 * `rawBody` MUST be the exact string Razorpay sent (req.text()), never a
 * re-serialisation of a parsed object: JSON.stringify reorders keys and drops
 * whitespace, so the HMAC would never match and every webhook would 401.
 *
 * This is the ONLY place that moves stock or advances order status (C3), and
 * its writes carry no authority guard, so they always overwrite whatever the
 * client optimistically recorded (C1).
 */
export async function handleWebhook(
  deps: WebhookDeps,
  rawBody: string,
  signature: string,
): Promise<WebhookResult> {
  // First operation in the function. This endpoint runs with verify_jwt =
  // false, so the HMAC is the only thing standing between it and the internet.
  const valid = await verifyHmacSha256(rawBody, signature, deps.webhookSecret);
  if (!valid) {
    console.error("[razorpay-webhook] signature mismatch; rejecting");
    return { status: 401, body: { error: "Invalid signature" } };
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "Malformed JSON" } };
  }

  const eventType = event.event ?? "";
  const entity = event.payload?.payment?.entity;
  const paymentId = entity?.id;
  const razorpayOrderId = entity?.order_id;

  if (!paymentId || !razorpayOrderId) {
    // Signature was valid, so this is a Razorpay event we simply do not model.
    // Acknowledge it: retrying will not make it parseable.
    console.warn("[razorpay-webhook] event without payment entity:", eventType);
    return { status: 200, body: { received: true } };
  }

  const order = await deps.findOrderByRazorpayOrderId(razorpayOrderId);
  if (!order) {
    console.warn("[razorpay-webhook] no local order for", razorpayOrderId);
    return { status: 200, body: { received: true } };
  }

  const isNew = await deps.recordEvent({
    orderId: order.id,
    paymentId,
    source: "webhook",
    eventType,
  });
  if (!isNew) {
    return { status: 200, body: { received: true } };
  }

  switch (eventType) {
    case "payment.captured":
      // Money has actually been captured. Only now does stock move.
      await deps.confirmPayment(order.id, paymentId);
      break;
    case "payment.failed":
      await deps.failPayment(order.id, paymentId);
      break;
    default:
      // Notably includes payment.authorized, which is NOT settled money.
      console.info("[razorpay-webhook] ignoring event:", eventType);
      break;
  }

  return { status: 200, body: { received: true } };
}
