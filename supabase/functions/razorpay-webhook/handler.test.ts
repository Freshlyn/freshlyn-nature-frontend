import { assertEquals } from "jsr:@std/assert@1";
import { handleWebhook, type WebhookDeps } from "./handler.ts";

const WEBHOOK_SECRET = "webhook-secret";

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function body(event: string, orderId = "order_1", paymentId = "pay_1"): string {
  return JSON.stringify({
    event,
    payload: {
      payment: {
        entity: { id: paymentId, order_id: orderId, amount: 1397, status: "captured" },
      },
    },
  });
}

function makeDeps(options: { orderFound?: boolean; duplicate?: boolean } = {}) {
  const calls = { confirm: [] as unknown[], fail: [] as unknown[], recordEvent: [] as unknown[] };

  const deps: WebhookDeps = {
    async findOrderByRazorpayOrderId(_id) {
      return options.orderFound === false ? null : { id: "local-order-1" };
    },
    async recordEvent(params) {
      calls.recordEvent.push(params);
      return !options.duplicate;
    },
    async confirmPayment(orderId, paymentId) {
      calls.confirm.push({ orderId, paymentId });
    },
    async failPayment(orderId, paymentId) {
      calls.fail.push({ orderId, paymentId });
    },
    webhookSecret: WEBHOOK_SECRET,
  };

  return { deps, calls };
}

Deno.test("payment.captured confirms the order and moves stock", async () => {
  const { deps, calls } = makeDeps();
  const raw = body("payment.captured");

  const result = await handleWebhook(deps, raw, await sign(raw));

  assertEquals(result.status, 200);
  assertEquals(calls.confirm.length, 1);
  assertEquals(calls.fail.length, 0);
});

Deno.test("payment.failed marks the order failed and moves no stock", async () => {
  const { deps, calls } = makeDeps();
  const raw = body("payment.failed");

  const result = await handleWebhook(deps, raw, await sign(raw));

  assertEquals(result.status, 200);
  assertEquals(calls.fail.length, 1);
  assertEquals(calls.confirm.length, 0);
});

// The only thing protecting a JWT-disabled public endpoint.
Deno.test("an invalid signature is rejected with 401 and writes nothing", async () => {
  const { deps, calls } = makeDeps();

  const result = await handleWebhook(deps, body("payment.captured"), "deadbeef");

  assertEquals(result.status, 401);
  assertEquals(calls.confirm.length, 0);
  assertEquals(calls.recordEvent.length, 0);
});

// Signature is computed over exact bytes: re-serialising JSON would break it.
Deno.test("a signature for different bytes is rejected", async () => {
  const { deps } = makeDeps();
  const signatureForOther = await sign(body("payment.captured", "order_OTHER"));

  const result = await handleWebhook(deps, body("payment.captured"), signatureForOther);

  assertEquals(result.status, 401);
});

// Razorpay retries. Acting twice would decrement stock twice for one payment.
Deno.test("a replayed webhook does not act twice", async () => {
  const { deps, calls } = makeDeps({ duplicate: true });
  const raw = body("payment.captured");

  const result = await handleWebhook(deps, raw, await sign(raw));

  assertEquals(result.status, 200);
  assertEquals(calls.confirm.length, 0);
});

// payment.authorized is NOT capture. Treating it as success is what produces
// the authorized-then-reversed false positive.
Deno.test("payment.authorized is acknowledged but acts on nothing", async () => {
  const { deps, calls } = makeDeps();
  const raw = body("payment.authorized");

  const result = await handleWebhook(deps, raw, await sign(raw));

  assertEquals(result.status, 200);
  assertEquals(calls.confirm.length, 0);
  assertEquals(calls.fail.length, 0);
});

// A non-2xx would make Razorpay retry an event we deliberately cannot handle.
Deno.test("an unknown order is acknowledged with 200", async () => {
  const { deps, calls } = makeDeps({ orderFound: false });
  const raw = body("payment.captured");

  const result = await handleWebhook(deps, raw, await sign(raw));

  assertEquals(result.status, 200);
  assertEquals(calls.confirm.length, 0);
});
