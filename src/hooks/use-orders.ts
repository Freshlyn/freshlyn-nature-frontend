import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "cancelled";
export type SubscriptionFrequency = "daily" | "alternate";
export type PaymentStatus =
  | "pending"
  | "failed"
  | "paid"
  | "collected"
  | "refunded";
export type PaymentMethod = "cod" | "razorpay";

export interface OrderItemWithDetails {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  delivery_type: "one_time" | "subscription";
  subscription_duration_days?: number;
  subscription_frequency?: SubscriptionFrequency;
  discount_percent?: number;
  created_at: string;
  product?: { id: string; name: string; image_url: string | null };
  variant?: { id: string; name: string };
}

export interface OrderWithItems {
  id: string;
  user_id: string;
  address_id: string | null;
  delivery_address: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  item_count: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  created_at: string;
  updated_at: string;
  items: OrderItemWithDetails[];
}

const ORDER_ITEM_SELECT = `
  id, order_id, product_id, variant_id, quantity, unit_price, delivery_type,
  subscription_duration_days, subscription_frequency, discount_percent, created_at,
  product:products(id, name, image_url),
  variant:product_variants(id, name)
`;

const ORDER_SELECT = `
  id, user_id, address_id, delivery_address, subtotal, delivery_fee, total,
  item_count, status, payment_status, payment_method, created_at, updated_at
`;

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async (): Promise<OrderWithItems[]> => {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .order("created_at", { ascending: false });
      if (ordersError) throw ordersError;
      if (!orders || orders.length === 0) return [];

      const orderIds = orders.map((o) => o.id);
      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select(ORDER_ITEM_SELECT)
        .in("order_id", orderIds);
      if (itemsError) throw itemsError;

      return orders.map((order) => ({
        ...order,
        items: (items ?? []).filter(
          (item) => item.order_id === order.id,
        ) as unknown as OrderItemWithDetails[],
      })) as OrderWithItems[];
    },
  });
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ["order", orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<OrderWithItems | null> => {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("id", orderId)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order) return null;

      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select(ORDER_ITEM_SELECT)
        .eq("order_id", orderId);
      if (itemsError) throw itemsError;

      return {
        ...order,
        items: (items ?? []) as unknown as OrderItemWithDetails[],
      } as OrderWithItems;
    },
  });
}
