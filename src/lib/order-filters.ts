import type { OrderWithItems } from '@/hooks/use-static-orders';
import type { OrderFilterState } from '@/components/orders/orderFilterTypes';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'out_for_delivery'];
const DAY_MS = 24 * 60 * 60 * 1000;

export function filterOrders(orders: OrderWithItems[], filters: OrderFilterState): OrderWithItems[] {
  return orders.filter((order) => {
    if (filters.type !== 'all') {
      const matchesType = order.items.some((item) => item.delivery_type === filters.type);
      if (!matchesType) return false;
    }

    if (filters.status === 'active' && !ACTIVE_STATUSES.includes(order.status)) return false;
    if (filters.status === 'delivered' && order.status !== 'delivered') return false;
    if (filters.status === 'cancelled' && order.status !== 'cancelled') return false;

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
