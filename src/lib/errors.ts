import { FunctionsHttpError } from "@supabase/supabase-js";

export async function getErrorMessage(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    const body = await err.context.json().catch(() => null);
    return body?.error ?? body?.message ?? "Something went wrong.";
  }
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Something went wrong.";
}
