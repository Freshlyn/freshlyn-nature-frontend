import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase-admin.ts";
import { createRazorpayClient, RazorpayError } from "../_shared/razorpay.ts";
import { handleCheckout, type CheckoutDeps, type CheckoutInput } from "./handler.ts";
import { DEFAULT_SETTINGS, parseSettingsRows } from "../_shared/app-settings.ts";

/**
 * The key id is public (the browser needs it to open Razorpay Checkout), but an
 * UNSET one is not: defaulting to "" would ship an empty key to every customer
 * and make the payment sheet fail opaquely. Fail loudly at buildDeps instead,
 * mirroring credentials() in ../_shared/razorpay.ts.
 */
function razorpayKeyId(): string {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
  if (!keyId) {
    throw new RazorpayError("Razorpay credentials are not configured.");
  }
  return keyId;
}

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
    async getSettings() {
      // Read through the admin client: app_settings has no write policy, and
      // its select policy is unconditional, so this is a plain read either way
      // -- but going through admin keeps it independent of the caller's token.
      const { data, error } = await admin.from("app_settings").select("key, value");
      // A settings read that fails must not fail the checkout. Falling back to
      // the shipped defaults charges the standard fee, which is both the safe
      // direction (never accidentally free) and what the cart displayed.
      if (error || !data) return DEFAULT_SETTINGS;
      return parseSettingsRows(data);
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
        p_decrement_stock: params.decrementStock,
        // Written in the same INSERT as the order row, never in a follow-up
        // UPDATE: supersedeStalePendingOrders filters on payment_method, so any
        // window in which a razorpay order is still nominally 'cod' would let a
        // concurrent sweep miss it and leave two live payable orders.
        p_payment_method: params.paymentMethod,
        // The customer's chosen delivery time. create_order stores it on the
        // order and derives every subscription_deliveries.scheduled_at from it,
        // so omitting it here silently defaults the parameter to null and the
        // whole schedule loses its time -- which is exactly what happened
        // before this line existed.
        p_delivery_slot: params.deliverySlot ?? null,
      });
      if (error || !data) throw new Error(error?.message ?? "create_order failed");
      return data as string;
    },
    async supersedeStalePendingOrders(userId) {
      // payment_authority is deliberately left null: if one of these attempts
      // was genuinely paid at the moment the customer retried, its own webhook
      // must still be able to correct it to paid under C1.
      const { error } = await admin
        .from("orders")
        .update({ payment_status: "failed" })
        .eq("user_id", userId)
        .eq("payment_status", "pending")
        .eq("payment_method", "razorpay");
      if (error) throw new Error(error.message);
    },
    async persistRazorpayOrderId(orderId, razorpayOrderId) {
      const { error } = await admin
        .from("orders")
        .update({ razorpay_order_id: razorpayOrderId })
        .eq("id", orderId);
      if (error) throw new Error(error.message);
    },
    razorpay: createRazorpayClient(),
    razorpayKeyId: razorpayKeyId(),
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[checkout] unhandled error:", message);
    return new Response(JSON.stringify({ error: "Checkout failed." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
