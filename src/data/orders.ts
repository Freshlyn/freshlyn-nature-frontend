export interface Order {
  id: string;
  user_id: string;
  total: number;
  item_count: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  delivery_address: string;
  delivery_fee: number;
  created_at: string;
  updated_at: string;
}

export const orders: Order[] = [
  { id: 'ord_001', user_id: 'usr_001', total: 130.24, item_count: 3, status: 'delivered', delivery_address: '123 Main St, Apt 4B, New York, NY 10001', delivery_fee: 0, created_at: '2024-01-15T10:30:00Z', updated_at: '2024-01-15T12:45:00Z' },
  { id: 'ord_002', user_id: 'usr_001', total: 48.85, item_count: 3, status: 'out_for_delivery', delivery_address: '123 Main St, Apt 4B, New York, NY 10001', delivery_fee: 5.0, created_at: '2024-01-20T09:15:00Z', updated_at: '2024-01-20T11:30:00Z' },
  { id: 'ord_003', user_id: 'usr_002', total: 17.97, item_count: 2, status: 'pending', delivery_address: '456 Oak Ave, Los Angeles, CA 90001', delivery_fee: 5.0, created_at: '2024-01-21T14:15:00Z', updated_at: '2024-01-21T14:15:00Z' },
  { id: 'ord_004', user_id: 'usr_003', total: 29.05, item_count: 3, status: 'confirmed', delivery_address: '789 Demo Lane, San Francisco, CA 94102', delivery_fee: 5.0, created_at: '2024-01-22T08:00:00Z', updated_at: '2024-01-22T08:05:00Z' },
];

export function getOrderById(id: string): Order | undefined {
  return orders.find((o) => o.id === id);
}

export function getOrdersByUserId(userId: string): Order[] {
  return orders
    .filter((o) => o.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
