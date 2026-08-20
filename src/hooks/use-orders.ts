import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { OrderFilterState } from "@/components/orders/orderFilterTypes";
import {
  ORDERS_PAGE_SIZE,
  dateRangeForFilter,
  keysetFilter,
  nextCursor,
  statusesForFilter,
  type OrderCursor,
} from "@/lib/order-query";

export type OrderStatus =
  "pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
export type SubscriptionFrequency = "daily" | "alternate";
export type PaymentStatus = "pending" | "failed" | "paid" | "collected" | "refunded";
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

/**
 * Attach each order's items. Always fetched unfiltered, even when a
 * delivery_type filter is active: the filter decides WHICH ORDERS match, but a
 * matching order's card must still show its whole basket. Selecting the joined
 * (filtered) items instead would drop a subscription order's one-time items
 * from its thumbnails and item count.
 */
async function attachItems(orders: OrderRow[]): Promise<OrderWithItems[]> {
  if (orders.length === 0) return [];

  const { data: items, error } = await supabase
    .from("order_items")
    .select(ORDER_ITEM_SELECT)
    .in(
      "order_id",
      orders.map((o) => o.id),
    );
  if (error) throw error;

  return orders.map((order) => ({
    ...order,
    items: (items ?? []).filter(
      (item) => item.order_id === order.id,
    ) as unknown as OrderItemWithDetails[],
  })) as OrderWithItems[];
}

type OrderRow = Omit<OrderWithItems, "items">;

export interface OrdersPage {
  orders: OrderWithItems[];
  nextCursor: OrderCursor | null;
}

/**
 * Paginated orders for the infinite-scroll list.
 *
 * Filtering happens server-side. With pagination, filtering the loaded pages
 * client-side would only ever search what had been scrolled to -- a filter
 * could show "no matches" while matching orders sat unfetched on the server.
 */
export function useInfiniteOrders(filters: OrderFilterState) {
  return useInfiniteQuery<OrdersPage>({
    // Filters are part of the key, so changing one restarts at page 1 rather
    // than appending a differently-filtered page to the existing list.
    queryKey: ["orders", "infinite", filters],
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    queryFn: async ({ pageParam }): Promise<OrdersPage> => {
      const cursor = pageParam as OrderCursor | null;
      const typeFilterActive = filters.type !== "all";

      // An inner join restricts the orders returned to those having at least
      // one item of the requested delivery_type. The joined column is selected
      // only to make the join happen; the items themselves come from
      // attachItems below.
      //
      // Typed as a plain string: supabase-js parses select() literals at the
      // type level, and a conditional one resolves to a ParserError rather than
      // a row type. The rows are cast to OrderRow at the boundary instead.
      const select: string = typeFilterActive
        ? `${ORDER_SELECT}, order_items!inner(delivery_type)`
        : ORDER_SELECT;

      let query = supabase.from("orders").select(select);

      if (typeFilterActive) query = query.eq("order_items.delivery_type", filters.type);

      // Abandoned or declined ONLINE payments are dead rows the customer never
      // paid for. Scoped to razorpay deliberately -- a COD order that reaches
      // payment_status.failed is a real order and must stay visible. Expressed
      // as "not (razorpay and failed)" so COD rows survive.
      query = query.or("payment_method.neq.razorpay,payment_status.neq.failed");

      const statuses = statusesForFilter(filters.status);
      if (statuses) query = query.in("status", statuses);

      const { from, to } = dateRangeForFilter(filters, Date.now());
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", to);

      if (cursor) query = query.or(keysetFilter(cursor));

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(ORDERS_PAGE_SIZE);
      if (error) throw error;

      const rawRows = (data ?? []) as unknown as OrderRow[];

      // An inner join emits one row per matching child, so an order with two
      // subscription items would otherwise appear twice.
      const rows = Array.from(new Map(rawRows.map((o) => [o.id, o])).values());

      return {
        orders: await attachItems(rows),
        // Derived from the raw page length, not the de-duplicated one: the
        // limit applies pre-dedup, so a full page is a full page.
        nextCursor: nextCursor(rawRows),
      };
    },
  });
}
