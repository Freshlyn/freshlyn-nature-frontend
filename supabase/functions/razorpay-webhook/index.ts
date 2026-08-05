import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { handleWebhook, type WebhookDeps } from "./handler.ts";

function buildDeps(): WebhookDeps {
  const admin = createAdminClient();

  return {
    async findOrderByRazorpayOrderId(razorpayOrderId) {
      const { data } = await admin
        .from("orders")
        .select("id")
        .eq("razorpay_order_id", razorpayOrderId)
        .maybeSingle();
      return data ? { id: data.id } : null;
    },
    async recordEvent({ orderId, paymentId, source, eventType }) {
      const { error } = await admin.from("payment_events").insert({
        order_id: orderId,
        razorpay_payment_id: paymentId,
        source,
        event_type: eventType,
      });
      if (error?.code === "23505") return false;
      if (error) throw new Error(error.message);
      return true;
    },
    async confirmPayment(orderId, paymentId) {
      const { error } = await admin.rpc("confirm_order_payment", {
        p_order_id: orderId,
        p_payment_id: paymentId,
      });
      if (error) throw new Error(error.message);
    },
    async failPayment(orderId, paymentId) {
      const { error } = await admin.rpc("fail_order_payment", {
        p_order_id: orderId,
        p_payment_id: paymentId,
      });
      if (error) throw new Error(error.message);
    },
    webhookSecret: Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // req.text(), never req.json(): the HMAC is computed over these exact bytes.
    const rawBody = await req.text();
    const signature = req.headers.get("X-Razorpay-Signature") ?? "";
    const result = await handleWebhook(buildDeps(), rawBody, signature);
    return new Response(JSON.stringify(result.body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: result.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[razorpay-webhook] unhandled error:", message);
    // 500 is correct here: an infrastructure failure SHOULD be retried by
    // Razorpay, unlike an event we deliberately chose not to handle.
    return new Response(JSON.stringify({ error: "Webhook processing failed." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
