export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export const cartItems: CartItem[] = [
  { id: 'cart_001', user_id: 'usr_001', product_id: 'prod_001', quantity: 2, created_at: '2024-01-20T10:00:00Z', updated_at: '2024-01-20T10:00:00Z' },
  { id: 'cart_002', user_id: 'usr_001', product_id: 'prod_003', quantity: 1, created_at: '2024-01-20T10:05:00Z', updated_at: '2024-01-20T10:05:00Z' },
  { id: 'cart_003', user_id: 'usr_002', product_id: 'prod_007', quantity: 1, created_at: '2024-01-20T14:30:00Z', updated_at: '2024-01-20T14:30:00Z' },
];

export function getCartItemsByUserId(userId: string): CartItem[] {
  return cartItems.filter((item) => item.user_id === userId);
}

export function getCartItemById(id: string): CartItem | undefined {
  return cartItems.find((item) => item.id === id);
}
