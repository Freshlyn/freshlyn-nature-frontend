import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CartItemWithDetails } from '@/hooks/use-static-cart';
import type { OrderWithItems } from '@/hooks/use-orders';

interface CheckoutInput {
  addressId: string;
  cartItems: CartItemWithDetails[];
}

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ addressId, cartItems }: CheckoutInput): Promise<OrderWithItems> => {
      const { data, error } = await supabase.functions.invoke('checkout', {
        body: {
          addressId,
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
      if (error) throw error;
      return data as OrderWithItems;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
