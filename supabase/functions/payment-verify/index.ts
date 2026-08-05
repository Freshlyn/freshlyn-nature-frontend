import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase-admin.ts";
import { handleVerifyPayment, type VerifyPaymentDeps, type VerifyPaymentInput } from "./handler.ts";

function buildDeps(authorizationHeader: string): VerifyPaymentDeps {
  const admin = createAdminClient();
  const userClient = createUserClient(authorizationHeader);

  return {
    async getCallerUserId() {
      const { data, error } = await userClient.auth.getUser();
      if (error || !data.user) return null;
      return data.user.id;
    },
    async findOrderByRazorpayOrderId(razorpayOrderId) {
      const { data } = await admin
        .from("orders")
        .select("id, user_id")
        .eq("razorpay_order_id", razorpayOrderId)
        .maybeSingle();
      if (!data) return null;
      return { id: data.id, userId: data.user_id };
    },
    async recordEvent({ orderId, paymentId, source, eventType }) {
      const { error } = await admin.from("payment_events").insert({
        order_id: orderId,
        razorpay_payment_id: paymentId,
        source,
        event_type: eventType,
      });
      // 23505 = unique_violation: this exact event was already processed. The
      // constraint is the arbiter, not a prior SELECT -- a check-then-insert
      // would leave a window for a concurrent duplicate.
      if (error?.code === "23505") return false;
      if (error) throw new Error(error.message);
      return true;
    },
    async markPaid(orderId, paymentId) {
      const { data, error } = await admin.rpc("client_mark_paid", {
        p_order_id: orderId,
        p_payment_id: paymentId,
      });
      if (error) throw new Error(error.message);
      return data === true;
    },
    keySecret: Deno.env.get("RAZORPAY_KEY_SECRET") ?? "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorizationHeader = req.headers.get("Authorization") ?? "";
    const input = (await req.json()) as VerifyPaymentInput;
    const result = await handleVerifyPayment(buildDeps(authorizationHeader), input);
    return new Response(JSON.stringify(result.body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: result.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[payment-verify] unhandled error:", message);
    return new Response(JSON.stringify({ error: "Payment verification failed." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
