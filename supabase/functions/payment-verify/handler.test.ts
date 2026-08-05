import { assertEquals } from "jsr:@std/assert@1";
import { handleVerifyPayment, type VerifyPaymentDeps } from "./handler.ts";

const KEY_SECRET = "test-secret";

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(KEY_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function makeDeps(options: {
  userId?: string | null;
  orderOwner?: string | null;
  duplicate?: boolean;
  markPaidResult?: boolean;
} = {}) {
  const calls = { recordEvent: [] as unknown[], markPaid: [] as unknown[] };

  const deps: VerifyPaymentDeps = {
    async getCallerUserId() {
      return options.userId === undefined ? "user-1" : options.userId;
    },
    async findOrderByRazorpayOrderId(_rzpOrderId) {
      if (options.orderOwner === null) return null;
      return { id: "order-1", userId: options.orderOwner ?? "user-1" };
    },
    async recordEvent(params) {
      calls.recordEvent.push(params);
      return !options.duplicate;
    },
    async markPaid(orderId, paymentId) {
      calls.markPaid.push({ orderId, paymentId });
      return options.markPaidResult ?? true;
    },
    keySecret: KEY_SECRET,
  };

  return { deps, calls };
}

Deno.test("a valid signature marks the order paid", async () => {
  const { deps, calls } = makeDeps();
  const signature = await sign("order_1|pay_1");

  const result = await handleVerifyPayment(deps, {
    razorpayOrderId: "order_1",
    razorpayPaymentId: "pay_1",
    razorpaySignature: signature,
  });

  assertEquals(result.status, 200);
  assertEquals(calls.markPaid.length, 1);
});

// The defence against a forged client callback.
Deno.test("a forged signature is rejected and writes nothing", async () => {
  const { deps, calls } = makeDeps();

  const result = await handleVerifyPayment(deps, {
    razorpayOrderId: "order_1",
    razorpayPaymentId: "pay_1",
    razorpaySignature: "deadbeef",
  });

  assertEquals(result.status, 400);
  assertEquals(calls.markPaid.length, 0);
  assertEquals(calls.recordEvent.length, 0);
});

Deno.test("an unauthenticated caller is rejected", async () => {
  const { deps } = makeDeps({ userId: null });
  const signature = await sign("order_1|pay_1");

  const result = await handleVerifyPayment(deps, {
    razorpayOrderId: "order_1",
    razorpayPaymentId: "pay_1",
    razorpaySignature: signature,
  });

  assertEquals(result.status, 401);
});

// Even a genuinely-signed callback must not let one customer touch another's
// order.
Deno.test("a caller who does not own the order is rejected with 403", async () => {
  const { deps, calls } = makeDeps({ orderOwner: "someone-else" });
  const signature = await sign("order_1|pay_1");

  const result = await handleVerifyPayment(deps, {
    razorpayOrderId: "order_1",
    razorpayPaymentId: "pay_1",
    razorpaySignature: signature,
  });

  assertEquals(result.status, 403);
  assertEquals(calls.markPaid.length, 0);
});

Deno.test("an unknown razorpay order id is rejected with 404", async () => {
  const { deps } = makeDeps({ orderOwner: null });
  const signature = await sign("order_1|pay_1");

  const result = await handleVerifyPayment(deps, {
    razorpayOrderId: "order_1",
    razorpayPaymentId: "pay_1",
    razorpaySignature: signature,
  });

  assertEquals(result.status, 404);
});

// Dedup: the client repeating itself must not write twice.
Deno.test("a replayed client callback does not write again", async () => {
  const { deps, calls } = makeDeps({ duplicate: true });
  const signature = await sign("order_1|pay_1");

  const result = await handleVerifyPayment(deps, {
    razorpayOrderId: "order_1",
    razorpayPaymentId: "pay_1",
    razorpaySignature: signature,
  });

  assertEquals(result.status, 200);
  assertEquals(calls.markPaid.length, 0);
});

// C2: the webhook has already decided, so the guarded update matches no rows.
// This is not an error -- the customer's payment is fine, the webhook simply
// got there first.
Deno.test("a no-op guarded update still returns 200", async () => {
  const { deps } = makeDeps({ markPaidResult: false });
  const signature = await sign("order_1|pay_1");

  const result = await handleVerifyPayment(deps, {
    razorpayOrderId: "order_1",
    razorpayPaymentId: "pay_1",
    razorpaySignature: signature,
  });

  assertEquals(result.status, 200);
});
