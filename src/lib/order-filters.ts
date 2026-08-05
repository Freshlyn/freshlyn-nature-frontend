import type { OrderWithItems } from '@/hooks/use-orders';
import type { OrderFilterState } from '@/components/orders/orderFilterTypes';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'out_for_delivery'];
// `failed` (delivery attempted but not completed) has no tab of its own, so it
// rides along with Cancelled -- otherwise those orders vanish from every tab.
const CANCELLED_STATUSES = ['cancelled', 'failed'];
const DAY_MS = 24 * 60 * 60 * 1000;

export function filterOrders(orders: OrderWithItems[], filters: OrderFilterState): OrderWithItems[] {
  return orders.filter((order) => {
    // Abandoned or declined online payments are dead rows: the customer never
    // paid and no stock was reserved. They stay in the database so payment
    // history is auditable, but they are not shown in the orders list.
    //
    // NOTE: payment_status.failed is NOT order_status.failed. The latter means
    // a delivery was attempted and did not happen, and is handled by
    // CANCELLED_STATUSES below. They are independent columns.
    //
    // Scoped to razorpay deliberately: only an online attempt is dead on
    // payment failure. A COD order that somehow reaches payment_status.failed is
    // a real order the customer placed, and must not silently vanish.
    if (order.payment_status === 'failed' && order.payment_method === 'razorpay') return false;

    if (filters.type !== 'all') {
      const matchesType = order.items.some((item) => item.delivery_type === filters.type);
      if (!matchesType) return false;
    }

    if (filters.status === 'active' && !ACTIVE_STATUSES.includes(order.status)) return false;
    if (filters.status === 'delivered' && order.status !== 'delivered') return false;
    if (filters.status === 'cancelled' && !CANCELLED_STATUSES.includes(order.status)) return false;

    if (filters.datePreset !== 'all') {
      const created = new Date(order.created_at).getTime();
      const now = Date.now();

      if (filters.datePreset === '7d' && now - created > 7 * DAY_MS) return false;
      if (filters.datePreset === '30d' && now - created > 30 * DAY_MS) return false;
      if (filters.datePreset === '3m' && now - created > 90 * DAY_MS) return false;

      if (filters.datePreset === 'custom') {
        if (filters.customFrom && created < new Date(filters.customFrom).getTime()) return false;
        if (filters.customTo && created > new Date(filters.customTo).getTime() + DAY_MS - 1) return false;
      }
    }

    return true;
  });
}
