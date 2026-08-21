import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { CartItemWithDetails } from "@/hooks/use-static-cart";
import type { OrderWithItems } from "@/hooks/use-orders";

interface CheckoutInput {
  addressId: string;
  cartItems: CartItemWithDetails[];
  paymentMethod: "cod" | "razorpay";
  /** 24-hour "HH:MM" from DELIVERY_SLOTS; the edge function re-validates it. */
  deliverySlot?: string;
}

export type CheckoutResponse = OrderWithItems & {
  razorpayOrderId?: string;
  razorpayKeyId?: string;
};

export function useCheckout() {
  return useMutation({
    mutationFn: async ({
      addressId,
      cartItems,
      paymentMethod,
      deliverySlot,
    }: CheckoutInput): Promise<CheckoutResponse> => {
      const { data, error } = await supabase.functions.invoke("checkout", {
        body: {
          addressId,
          paymentMethod,
          deliverySlot,
          items: cartItems.map((item) => ({
            productId: item.product_id,
            variantId: item.variant_id,
            quantity: item.quantity,
            deliveryType: item.delivery_type,
            subscriptionDurationDays: item.subscription_duration,
            subscriptionFrequency: item.subscription_frequency,
            subscriptionStartDate: item.subscription_start_date,
          })),
        },
      });
      // LOAD-BEARING: rethrow the raw FunctionsHttpError as-is, do not wrap it
      // (e.g. `throw new Error(error.message)`). getErrorMessage in
      // src/lib/errors.ts reads the ORIGINAL response body (`body.error`) off
      // this exact error object to surface the edge function's user-facing
      // 422 message (e.g. "we don't deliver to this address"). Wrapping it
      // loses that body, and every caller would silently degrade to the
      // generic "Edge Function returned a non-2xx status code" toast -- with
      // every existing test still green, since only handler.ts covers the
      // 422 contract today.
      if (error) throw error;
      return data as CheckoutResponse;
    },
    // Deliberately NOT invalidating ["orders"] here. This mutation resolves when
    // the Razorpay *order* is created, which is before the customer has paid --
    // invalidating now refetches (and settles) the orders list while the payment
    // modal is still open, so /orders later mounts against a warm cache with
    // isLoading already false: no skeleton, and the data predates the new order.
    // The caller invalidates once the payment outcome is known instead.
    //
    // COD has no modal, but the caller invalidates on that path too, so the
    // ordering stays the same for both payment methods.
  });
}
