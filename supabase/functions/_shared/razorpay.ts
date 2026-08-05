// All Razorpay contact lives here.
//
// Two properties of the integration drive this module's shape:
//
//   1. Razorpay works in integer paise, the database in numeric(10,2). Every
//      amount crosses that boundary exactly once, in toPaise.
//   2. Signature verification is the ONLY thing standing between a public
//      webhook endpoint and forged payment confirmations, so the comparison is
//      constant-time and the raw payload is never re-serialised before hashing.

const BASE_URL = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 10_000;

export class RazorpayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RazorpayError";
  }
}

export interface RazorpayClient {
  /** Creates a Razorpay order. Resolves to the razorpay order id (order_...). */
  createOrder(params: {
    amountPaise: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ id: string }>;
}

/**
 * Rupees -> integer paise.
 *
 * Math.round is load-bearing: 1.99 * 100 is 198.99999999999997 in IEEE-754, so
 * truncation would silently undercharge by a paisa on a large share of prices.
 */
export function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time HMAC-SHA256 comparison.
 *
 * A short-circuiting `===` leaks, through timing, how many leading bytes were
 * correct -- enough to forge a signature byte by byte given sufficient attempts.
 * The loop below always inspects every byte.
 */
export async function verifyHmacSha256(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const expected = toHex(digest);

  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

function credentials(): string {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
  if (!keyId || !keySecret) {
    throw new RazorpayError("Razorpay credentials are not configured.");
  }
  return btoa(`${keyId}:${keySecret}`);
}

export function createRazorpayClient(fetchImpl: typeof fetch = fetch): RazorpayClient {
  return {
    async createOrder({ amountPaise, receipt, notes }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetchImpl(`${BASE_URL}/orders`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${credentials()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: amountPaise,
            currency: "INR",
            receipt,
            notes: notes ?? {},
          }),
          signal: controller.signal,
        });

        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
          // Razorpay's description is operational detail -- surfaced to logs by
          // the caller, never to a customer.
          const detail = body?.error?.description ?? `HTTP ${response.status}`;
          throw new RazorpayError(`Razorpay order creation failed: ${detail}`);
        }

        if (!body?.id) {
          throw new RazorpayError("Razorpay returned no order id.");
        }

        return { id: body.id as string };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
