import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";

/**
 * True when a failure is the network giving out rather than the server saying
 * no.
 *
 * supabase-js raises FunctionsFetchError when `fetch` itself rejects, which is
 * what a dead connection produces. Plain `fetch` (and anything not routed
 * through functions.invoke) rejects with a TypeError whose message is
 * "Failed to fetch" / "Load failed" / "NetworkError ..." depending on the
 * engine, so those are matched too.
 */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof FunctionsFetchError) return true;
  if (err instanceof TypeError) {
    return /failed to fetch|load failed|networkerror|network request failed/i.test(err.message);
  }
  return false;
}

interface RejectedItem {
  productId: string;
  variantId: string;
  reason: "insufficient_stock" | "quantity_limit_exceeded";
  maxQuantityPerOrder?: number;
}

/**
 * Turns a checkout 409's rejectedItems into something a shopper can act on.
 *
 * The body's own `error` for this status is the generic "One or more items
 * failed validation", which names neither the item nor the fix. The structured
 * payload alongside it carries the allowed maximum, so prefer it.
 *
 * Returns null when there is nothing to describe, leaving other statuses (the
 * 422 serviceability message in particular) to fall through untouched.
 */
function describeRejectedItems(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items = value as RejectedItem[];

  if (items.length > 1) {
    // Naming every item makes for an unreadable toast; the cart shows the caps
    // per line, so point there rather than enumerating.
    return `${items.length} items in your cart are unavailable in the quantity you selected. Please review your cart and try again.`;
  }

  const [item] = items;
  if (item.reason === "quantity_limit_exceeded" && typeof item.maxQuantityPerOrder === "number") {
    return `You can order at most ${item.maxQuantityPerOrder} of one item per order. Please lower the quantity and try again.`;
  }
  if (item.reason === "insufficient_stock") {
    return "An item in your cart is out of stock in the quantity you selected. Please lower the quantity and try again.";
  }
  return null;
}

/**
 * A user-facing message, with lost connectivity called out explicitly.
 *
 * A raw "TypeError: Failed to fetch" in a toast tells a customer nothing and
 * reads like a crash. Naming the actual cause -- and that retrying is the fix
 * -- is the whole point of surfacing the error at all.
 */
export async function getErrorMessage(err: unknown): Promise<string> {
  if (isNetworkError(err)) {
    return "No internet connection. Check your connection and try again.";
  }
  if (err instanceof FunctionsHttpError) {
    const body = await err.context.json().catch(() => null);
    const rejection = describeRejectedItems(body?.rejectedItems);
    if (rejection) return rejection;
    return body?.error ?? body?.message ?? "Something went wrong.";
  }
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Something went wrong.";
}
