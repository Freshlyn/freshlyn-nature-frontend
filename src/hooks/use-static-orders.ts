import { useState, useCallback, useSyncExternalStore, useMemo } from 'react';
import type { Order } from '@/data/orders';
import { orders as initialOrders } from '@/data/orders';
import type { OrderItem } from '@/data/order_items';
import { orderItems as initialOrderItems } from '@/data/order_items';
import type { Product } from '@/data/products';
import { getProductById } from '@/data/products';
import type { ProductVariant } from '@/data/product_variants';
import { getVariantById } from '@/data/product_variants';
import { useStaticCart } from './use-static-cart';
import { useStaticAuth } from './use-static-auth';

let localOrders: Order[] = [...initialOrders];
let localOrderItems: OrderItem[] = [...initialOrderItems];
let orderIdCounter = 5;
let orderItemIdCounter = 12;
let ordersListeners: Set<() => void> = new Set();

function emitOrdersChange() {
  ordersListeners.forEach((l) => l());
}

function subscribeOrders(listener: () => void) {
  ordersListeners.add(listener);
  return () => ordersListeners.delete(listener);
}

function getOrdersSnapshot() {
  return localOrders;
}

function getOrderItemsSnapshot() {
  return localOrderItems;
}

export interface OrderItemWithDetails extends OrderItem {
  product?: Product;
  variant?: ProductVariant;
}

export interface OrderWithItems extends Order {
  items: OrderItemWithDetails[];
}

export function useStaticOrders() {
  const orders = useSyncExternalStore(subscribeOrders, getOrdersSnapshot, getOrdersSnapshot);
  const orderItems = useSyncExternalStore(subscribeOrders, getOrderItemsSnapshot, getOrderItemsSnapshot);
  const { user } = useStaticAuth();

  const userOrders = useMemo((): OrderWithItems[] => {
    if (!user) return [];
    return orders
      .filter((o) => o.user_id === user.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((order) => ({
        ...order,
        items: orderItems
          .filter((item) => item.order_id === order.id)
          .map((item) => ({ ...item, product: getProductById(item.product_id), variant: getVariantById(item.variant_id) })),
      }));
  }, [user, orders, orderItems]);

  const getOrderDetail = useCallback(
    (orderId: string): OrderWithItems | null => {
      if (!user) return null;
      const order = localOrders.find((o) => o.id === orderId && o.user_id === user.id);
      if (!order) return null;
      return {
        ...order,
        items: localOrderItems
          .filter((item) => item.order_id === order.id)
          .map((item) => ({ ...item, product: getProductById(item.product_id), variant: getVariantById(item.variant_id) })),
      };
    },
    [user],
  );

  return { orders: userOrders, getOrderDetail, isLoading: false, error: null };
}

export function useCreateStaticOrder() {
  const { getCartWithProducts, getCartTotal, clearCart } = useStaticCart();
  const { user } = useStaticAuth();
  const [isPending, setIsPending] = useState(false);

  const createOrder = useCallback(
    async (options?: { addressId?: string; deliveryTime?: string }) => {
      if (!user) throw new Error('User not logged in');

      setIsPending(true);
      await new Promise((r) => setTimeout(r, 500));

      const cartItems = getCartWithProducts();
      const subtotal = getCartTotal();
      const deliveryFee = subtotal > 50 ? 0 : 5.0;
      const total = subtotal + deliveryFee;
      const now = new Date().toISOString();
      const orderId = `ord_${String(orderIdCounter++).padStart(3, '0')}`;

      const selectedAddr = options?.addressId
        ? user.addresses.find((a) => a.id === options.addressId)
        : user.addresses.find((a) => a.is_default) || user.addresses[0];

      const deliveryAddress = selectedAddr
        ? [selectedAddr.flat_house, selectedAddr.building, selectedAddr.street, selectedAddr.landmark, selectedAddr.city, `${selectedAddr.state} ${selectedAddr.pincode}`]
            .filter(Boolean)
            .join(', ')
        : 'No address provided';

      const newOrder: Order = {
        id: orderId,
        user_id: user.id,
        total,
        item_count: cartItems.length,
        status: 'pending',
        delivery_address: deliveryAddress,
        delivery_fee: deliveryFee,
        created_at: now,
        updated_at: now,
      };

      const newOrderItems: OrderItem[] = cartItems.map((item) => ({
        id: `oi_${String(orderItemIdCounter++).padStart(3, '0')}`,
        order_id: orderId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.variant.price,
        delivery_type: item.delivery_type,
        subscription_duration: item.subscription_duration,
        subscription_frequency: item.subscription_frequency,
        delivery_count: item.delivery_count,
        discount_percent: item.discount_percent,
        created_at: now,
      }));

      localOrders = [newOrder, ...localOrders];
      localOrderItems = [...localOrderItems, ...newOrderItems];

      clearCart();
      emitOrdersChange();
      setIsPending(false);

      return newOrder;
    },
    [user, getCartWithProducts, getCartTotal, clearCart],
  );

  return { createOrder, isPending };
}
