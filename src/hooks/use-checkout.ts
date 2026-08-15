import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { CartItemWithDetails } from "@/hooks/use-static-cart";
import type { OrderWithItems } from "@/hooks/use-orders";

interface CheckoutInput {
  addressId: string;
  cartItems: CartItemWithDetails[];
  paymentMethod: "cod" | "razorpay";
}

export type CheckoutResponse = OrderWithItems & {
  razorpayOrderId?: string;
  razorpayKeyId?: string;
};

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      addressId,
      cartItems,
      paymentMethod,
    }: CheckoutInput): Promise<CheckoutResponse> => {
      const { data, error } = await supabase.functions.invoke("checkout", {
        body: {
          addressId,
          paymentMethod,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
