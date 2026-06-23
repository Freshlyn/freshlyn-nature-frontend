export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type DeliveryType = 'one_time' | 'subscription';

export type SubscriptionFrequency = 'daily' | 'alternate' | 'every_3rd';

export interface DbUserAddress {
  id: string;
  user_id: string;
  label: string;
  flat_house: string;
  building: string | null;
  street: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  created_at: string;
}

export interface DbUser {
  id: string;
  email: string | null;
  name: string;
  phone: string;
  created_at: string;
}

export interface DbProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string | null;
  stock_quantity: number;
  unit: string;
  is_available: boolean;
  created_at: string;
}

export interface DbProductVariant {
  id: string;
  product_id: string;
  name: string;
  quantity_value: number;
  quantity_unit: string;
  price: number;
  stock_quantity: number;
  is_default: boolean;
}

export interface DbOrder {
  id: string;
  user_id: string;
  total: number;
  item_count: number;
  status: OrderStatus;
  delivery_address: string;
  delivery_fee: number;
  created_at: string;
  updated_at: string;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  delivery_type: DeliveryType;
  subscription_duration: number | null;
  subscription_frequency: SubscriptionFrequency | null;
  delivery_count: number | null;
  discount_percent: number | null;
  created_at: string;
}
