import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase-admin.ts";
import { handleCheckout, type CheckoutDeps, type CheckoutInput } from "./handler.ts";

function buildDeps(authorizationHeader: string): CheckoutDeps {
  const admin = createAdminClient();
  const userClient = createUserClient(authorizationHeader);

  return {
    async getCallerUserId() {
      const { data, error } = await userClient.auth.getUser();
      if (error || !data.user) return null;
      return data.user.id;
    },
    async getVariant(productId, variantId) {
      const { data } = await admin
        .from("product_variants")
        .select("price, stock_quantity, max_quantity_per_order")
        .eq("id", variantId)
        .eq("product_id", productId)
        .maybeSingle();
      if (!data) return null;
      return {
        price: data.price,
        stockQuantity: data.stock_quantity,
        maxQuantityPerOrder: data.max_quantity_per_order,
      };
    },
    async getSubscriptionOption(productId, durationDays) {
      const { data: config } = await admin
        .from("subscription_configs")
        .select("enabled, frequencies")
        .eq("product_id", productId)
        .maybeSingle();
      if (!config) return null;

      const { data: duration } = await admin
        .from("subscription_durations")
        .select("discount_percent")
        .eq("product_id", productId)
        .eq("duration_days", durationDays)
        .maybeSingle();
      if (!duration) return null;

      return {
        enabled: config.enabled,
        frequencies: config.frequencies,
        discountPercent: duration.discount_percent,
      };
    },
    async getAddress(addressId) {
      const { data } = await userClient
        .from("addresses")
        .select("flat_house, building, street, landmark, city, state, pincode")
        .eq("id", addressId)
        .maybeSingle();
      if (!data) return null;
      return {
        flatHouse: data.flat_house,
        building: data.building,
        street: data.street,
        landmark: data.landmark,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
      };
    },
    async createOrder(params) {
      const { data, error } = await admin.rpc("create_order", {
        p_user_id: params.userId,
        p_address_id: params.addressId,
        p_delivery_address: params.deliveryAddress,
        p_items: params.items,
        p_subtotal: params.subtotal,
        p_delivery_fee: params.deliveryFee,
        p_total: params.total,
      });
      if (error || !data) throw new Error(error?.message ?? "create_order failed");
      return data as string;
    },
    async applyPaymentResult(orderId, paymentStatus, paymentMethod) {
      const { error } = await admin
        .from("orders")
        .update({ payment_status: paymentStatus, payment_method: paymentMethod })
        .eq("id", orderId);
      if (error) throw new Error(error.message);
    },
    async fetchOrderWithItems(orderId) {
      const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single();
      const { data: items } = await admin.from("order_items").select("*").eq("order_id", orderId);
      return { ...order, items: items ?? [] };
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorizationHeader = req.headers.get("Authorization") ?? "";
    const input = (await req.json()) as CheckoutInput;
    const result = await handleCheckout(buildDeps(authorizationHeader), input);
    return new Response(JSON.stringify(result.body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: result.status,
    });
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Checkout failed." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
