import type { SubscriptionFrequency } from './product_variants';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  delivery_type: 'one_time' | 'subscription';
  subscription_duration?: number;
  subscription_frequency?: SubscriptionFrequency;
  delivery_count?: number;
  discount_percent?: number;
  created_at: string;
}

export const orderItems: OrderItem[] = [
  { id: 'oi_001', order_id: 'ord_001', product_id: 'prod_001', variant_id: 'var_002', quantity: 1, unit_price: 2.99, delivery_type: 'subscription', subscription_duration: 30, subscription_frequency: 'daily', delivery_count: 30, discount_percent: 10, created_at: '2024-01-15T10:30:00Z' },
  { id: 'oi_002', order_id: 'ord_001', product_id: 'prod_003', variant_id: 'var_008', quantity: 1, unit_price: 3.99, delivery_type: 'one_time', created_at: '2024-01-15T10:30:00Z' },
  { id: 'oi_003', order_id: 'ord_001', product_id: 'prod_023', variant_id: 'var_057', quantity: 1, unit_price: 5.99, delivery_type: 'subscription', subscription_duration: 15, subscription_frequency: 'alternate', delivery_count: 8, discount_percent: 5, created_at: '2024-01-15T10:30:00Z' },
  { id: 'oi_004', order_id: 'ord_002', product_id: 'prod_002', variant_id: 'var_005', quantity: 2, unit_price: 1.99, delivery_type: 'one_time', created_at: '2024-01-20T09:15:00Z' },
  { id: 'oi_005', order_id: 'ord_002', product_id: 'prod_005', variant_id: 'var_013', quantity: 1, unit_price: 5.99, delivery_type: 'one_time', created_at: '2024-01-20T09:15:00Z' },
  { id: 'oi_006', order_id: 'ord_002', product_id: 'prod_006', variant_id: 'var_015', quantity: 1, unit_price: 4.99, delivery_type: 'subscription', subscription_duration: 7, subscription_frequency: 'daily', delivery_count: 7, discount_percent: 3, created_at: '2024-01-20T09:15:00Z' },
  { id: 'oi_007', order_id: 'ord_003', product_id: 'prod_011', variant_id: 'var_030', quantity: 2, unit_price: 3.99, delivery_type: 'one_time', created_at: '2024-01-21T14:15:00Z' },
  { id: 'oi_008', order_id: 'ord_003', product_id: 'prod_016', variant_id: 'var_041', quantity: 1, unit_price: 4.99, delivery_type: 'one_time', created_at: '2024-01-21T14:15:00Z' },
  { id: 'oi_009', order_id: 'ord_004', product_id: 'prod_021', variant_id: 'var_051', quantity: 1, unit_price: 1.49, delivery_type: 'subscription', subscription_duration: 10, subscription_frequency: 'alternate', delivery_count: 5, discount_percent: 5, created_at: '2024-01-22T08:00:00Z' },
  { id: 'oi_010', order_id: 'ord_004', product_id: 'prod_004', variant_id: 'var_010', quantity: 1, unit_price: 2.99, delivery_type: 'one_time', created_at: '2024-01-22T08:00:00Z' },
  { id: 'oi_011', order_id: 'ord_004', product_id: 'prod_010', variant_id: 'var_027', quantity: 2, unit_price: 6.99, delivery_type: 'one_time', created_at: '2024-01-22T08:00:00Z' },
];

export function getOrderItemsByOrderId(orderId: string): OrderItem[] {
  return orderItems.filter((item) => item.order_id === orderId);
}

export function getOrderItemById(id: string): OrderItem | undefined {
  return orderItems.find((item) => item.id === id);
}
