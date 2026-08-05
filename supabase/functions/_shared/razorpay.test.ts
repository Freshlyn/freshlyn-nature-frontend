import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  createRazorpayClient,
  RazorpayError,
  toPaise,
  verifyHmacSha256,
} from "./razorpay.ts";

function fakeFetch(body: unknown, status = 200): typeof fetch {
  return ((_input: string | URL | Request, _init?: RequestInit) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }))) as typeof fetch;
}

Deno.env.set("RAZORPAY_KEY_ID", "rzp_test_key");
Deno.env.set("RAZORPAY_KEY_SECRET", "test-secret");

// The regression guard that matters: 1.99 * 100 is 198.99999999999997 in
// IEEE-754. Truncating would bill 198 paise instead of 199.
Deno.test("toPaise rounds rather than truncating", () => {
  assertEquals(toPaise(1.99), 199);
  assertEquals(toPaise(2.99), 299);
  assertEquals(toPaise(13.97), 1397);
  assertEquals(toPaise(0), 0);
});

Deno.test("verifyHmacSha256 accepts a correct signature", async () => {
  // Precomputed: HMAC-SHA256("order_1|pay_1", "test-secret")
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("test-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("order_1|pay_1"),
  );
  const expected = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  assertEquals(await verifyHmacSha256("order_1|pay_1", expected, "test-secret"), true);
});

Deno.test("verifyHmacSha256 rejects a forged signature", async () => {
  assertEquals(await verifyHmacSha256("order_1|pay_1", "deadbeef", "test-secret"), false);
});

Deno.test("verifyHmacSha256 rejects a signature for different content", async () => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("test-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("order_1|pay_1"),
  );
  const sigForOther = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  assertEquals(
    await verifyHmacSha256("order_2|pay_2", sigForOther, "test-secret"),
    false,
  );
});

Deno.test("createOrder returns the razorpay order id", async () => {
  const client = createRazorpayClient(
    fakeFetch({ id: "order_abc123", amount: 1397, currency: "INR" }),
  );
  const result = await client.createOrder({ amountPaise: 1397, receipt: "local-1" });
  assertEquals(result.id, "order_abc123");
});

Deno.test("createOrder throws RazorpayError on a non-2xx response", async () => {
  const client = createRazorpayClient(
    fakeFetch({ error: { description: "Invalid amount" } }, 400),
  );
  await assertRejects(
    () => client.createOrder({ amountPaise: 0, receipt: "local-1" }),
    RazorpayError,
  );
});
