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
    return body?.error ?? body?.message ?? "Something went wrong.";
  }
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Something went wrong.";
}
