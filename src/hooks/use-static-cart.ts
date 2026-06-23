import { useCallback, useSyncExternalStore, useMemo } from 'react';
import type { Product } from '@/data/products';
import { getProductById } from '@/data/products';
import type { ProductVariant, SubscriptionFrequency } from '@/data/product_variants';
import { getVariantById, getFrequencyLabel, calculateDeliveryCount, getSubscriptionConfig } from '@/data/product_variants';
import { useToast } from '@/hooks/use-toast';

export interface LocalCartItem {
  id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  delivery_type: 'one_time' | 'subscription';
  subscription_duration?: number;
  subscription_frequency?: SubscriptionFrequency;
}

export interface CartItemWithDetails {
  id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  delivery_type: 'one_time' | 'subscription';
  subscription_duration?: number;
  subscription_frequency?: SubscriptionFrequency;
  product: Product;
  variant: ProductVariant;
  item_total: number;
  delivery_count?: number;
  discount_percent?: number;
}

const CART_KEY = 'freshlyn_cart';
const CART_ID_KEY = 'freshlyn_cart_id';

function loadCart(): LocalCartItem[] {
  try {
    const stored = localStorage.getItem(CART_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function loadCartId(): number {
  try {
    const stored = localStorage.getItem(CART_ID_KEY);
    return stored ? parseInt(stored, 10) : 1;
  } catch {
    return 1;
  }
}

function saveCart(cart: LocalCartItem[], id: number) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    localStorage.setItem(CART_ID_KEY, id.toString());
  } catch {
    // Storage may be unavailable
  }
}

let globalCart: LocalCartItem[] = loadCart();
let cartIdCounter = loadCartId();
let cartListeners: Set<() => void> = new Set();

function emitChange() {
  saveCart(globalCart, cartIdCounter);
  cartListeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  cartListeners.add(listener);
  return () => cartListeners.delete(listener);
}

function getSnapshot() {
  return globalCart;
}

function getItemKey(
  productId: string,
  variantId: string,
  deliveryType: 'one_time' | 'subscription',
  subscriptionDuration?: number,
  subscriptionFrequency?: SubscriptionFrequency,
): string {
  if (deliveryType === 'subscription') {
    return `${productId}_${variantId}_sub_${subscriptionDuration}_${subscriptionFrequency}`;
  }
  return `${productId}_${variantId}_onetime`;
}

export function useStaticCart() {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { toast } = useToast();

  const addToCart = useCallback(
    (params: {
      productId: string;
      variantId: string;
      quantity: number;
      deliveryType: 'one_time' | 'subscription';
      subscriptionDuration?: number;
      subscriptionFrequency?: SubscriptionFrequency;
    }) => {
      const { productId, variantId, quantity, deliveryType, subscriptionDuration, subscriptionFrequency } = params;
      const itemKey = getItemKey(productId, variantId, deliveryType, subscriptionDuration, subscriptionFrequency);

      const existing = globalCart.find((item) => {
        return getItemKey(item.product_id, item.variant_id, item.delivery_type, item.subscription_duration, item.subscription_frequency) === itemKey;
      });

      if (existing) {
        globalCart = globalCart.map((item) =>
          getItemKey(item.product_id, item.variant_id, item.delivery_type, item.subscription_duration, item.subscription_frequency) === itemKey
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      } else {
        globalCart = [
          ...globalCart,
          {
            id: `local_cart_${cartIdCounter++}`,
            product_id: productId,
            variant_id: variantId,
            quantity,
            delivery_type: deliveryType,
            subscription_duration: subscriptionDuration,
            subscription_frequency: subscriptionFrequency,
          },
        ];
      }

      emitChange();

      const variant = getVariantById(variantId);
      const product = getProductById(productId);

      if (deliveryType === 'subscription') {
        toast({ title: 'Subscription added', description: `${product?.name} (${variant?.name}) - ${subscriptionDuration} days subscription` });
      } else {
        toast({ title: 'Added to cart', description: `${product?.name} (${variant?.name}) added to your basket.` });
      }
    },
    [toast],
  );

  const addToCartSimple = useCallback(
    (productId: string, variantId: string, quantity = 1) => {
      addToCart({ productId, variantId, quantity, deliveryType: 'one_time' });
    },
    [addToCart],
  );

  const updateQuantity = useCallback((cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      globalCart = globalCart.filter((i) => i.id !== cartItemId);
    } else {
      globalCart = globalCart.map((item) => (item.id === cartItemId ? { ...item, quantity } : item));
    }
    emitChange();
  }, []);

  const removeFromCart = useCallback((cartItemId: string) => {
    globalCart = globalCart.filter((item) => item.id !== cartItemId);
    emitChange();
  }, []);

  const clearCart = useCallback(() => {
    globalCart = [];
    emitChange();
  }, []);

  const getQuantity = useCallback(
    (productId: string): number => {
      return cart.filter((i) => i.product_id === productId).reduce((sum, item) => sum + item.quantity, 0);
    },
    [cart],
  );

  const cartWithProducts = useMemo((): CartItemWithDetails[] => {
    const result: CartItemWithDetails[] = [];
    for (const item of cart) {
      const product = getProductById(item.product_id);
      const variant = getVariantById(item.variant_id);
      if (!product || !variant) continue;

      let itemTotal = variant.price * item.quantity;
      let deliveryCount: number | undefined;
      let discountPercent: number | undefined;

      if (item.delivery_type === 'subscription' && item.subscription_duration && item.subscription_frequency) {
        deliveryCount = calculateDeliveryCount(item.subscription_duration, item.subscription_frequency);
        const config = getSubscriptionConfig(item.product_id);
        discountPercent = config?.durations.find((d) => d.duration_days === item.subscription_duration)?.discount_percent;
        itemTotal = variant.price * deliveryCount * (1 - (discountPercent || 0) / 100);
      }

      result.push({
        id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        delivery_type: item.delivery_type,
        subscription_duration: item.subscription_duration,
        subscription_frequency: item.subscription_frequency,
        product,
        variant,
        item_total: itemTotal,
        delivery_count: deliveryCount,
        discount_percent: discountPercent,
      });
    }
    return result;
  }, [cart]);

  const cartTotal = useMemo(() => cartWithProducts.reduce((t, item) => t + item.item_total, 0), [cartWithProducts]);
  const cartCount = useMemo(() => cart.reduce((c, item) => c + item.quantity, 0), [cart]);

  return {
    cart,
    addToCart,
    addToCartSimple,
    updateQuantity,
    removeFromCart,
    clearCart,
    getQuantity,
    getCartWithProducts: () => cartWithProducts,
    getCartTotal: () => cartTotal,
    getCartCount: () => cartCount,
  };
}
