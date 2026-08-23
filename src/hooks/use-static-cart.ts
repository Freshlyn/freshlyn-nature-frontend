import { useCallback, useSyncExternalStore, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Product, ProductVariant, SubscriptionFrequency } from "@/hooks/use-products";
import { useToast } from "@/hooks/use-toast";

export interface LocalCartItem {
  id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  delivery_type: "one_time" | "subscription";
  subscription_duration?: number;
  subscription_frequency?: SubscriptionFrequency;
  subscription_start_date?: string;
}

export interface CartItemWithDetails {
  id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  delivery_type: "one_time" | "subscription";
  subscription_duration?: number;
  subscription_frequency?: SubscriptionFrequency;
  subscription_start_date?: string;
  product: Product;
  variant: ProductVariant;
  /** Highest quantity allowed for this item; see resolveQuantityCap. */
  max_quantity: number;
  item_total: number;
  delivery_count?: number;
  discount_percent?: number;
}

const CART_KEY = "freshlyn_cart";
const CART_ID_KEY = "freshlyn_cart_id";

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

/**
 * Wipe the cart store and its persisted copy. Used on logout: clearing only the
 * localStorage keys is not enough, because `globalCart` is module state that is
 * read once at load — the stale items would stay on screen and get written back
 * to storage by the next mutation.
 */
export function resetCartStore() {
  globalCart = [];
  cartIdCounter = 1;
  try {
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(CART_ID_KEY);
  } catch {
    // Storage may be unavailable
  }
  cartListeners.forEach((l) => l());
}

function getItemKey(
  productId: string,
  variantId: string,
  deliveryType: "one_time" | "subscription",
  subscriptionDuration?: number,
  subscriptionFrequency?: SubscriptionFrequency,
): string {
  if (deliveryType === "subscription") {
    return `${productId}_${variantId}_sub_${subscriptionDuration}_${subscriptionFrequency}`;
  }
  return `${productId}_${variantId}_onetime`;
}

/** Per-order cap applied when a variant payload carries no limit of its own. */
export const DEFAULT_MAX_QUANTITY_PER_ORDER = 100;

/**
 * The highest quantity a customer may hold of one variant.
 *
 * Two independent ceilings bind here: the variant's own max_quantity_per_order
 * and what is actually in stock. Whichever is tighter wins -- Milk ships with a
 * deliberately-lowered limit of 10 against ~100 units of stock, but a nearly
 * sold-out variant inverts that.
 *
 * The fallback covers a MISSING field, not a wrong one. The column is NOT NULL
 * in the database, so this only catches a client-side hole (a cached or
 * partially-mapped variant). A limit that is present but wrong is a data fix --
 * capping harder here would just make the client disagree with the server,
 * which still has the final say at checkout.
 */
export function resolveQuantityCap(variant: {
  max_quantity_per_order?: number;
  stock_quantity?: number;
}): number {
  const limit = variant.max_quantity_per_order ?? DEFAULT_MAX_QUANTITY_PER_ORDER;
  // Absent stock means "unknown", not "none" -- defaulting it to 0 would make
  // every item in such a payload unaddable.
  const stock = variant.stock_quantity ?? Number.POSITIVE_INFINITY;
  // An out-of-stock variant yields 0, never a negative cap.
  return Math.max(0, Math.min(limit, stock));
}

/**
 * Applies a cap to a requested quantity, reporting whether it actually bit.
 *
 * `limitReached` is true only when the request was REFUSED -- i.e. the customer
 * asked for more than they can have. Landing exactly on the cap is a successful
 * add and stays quiet; it is the next tap, which cannot move the number, that
 * earns the message. This mirrors Blinkit, which toasts on every refused tap
 * rather than disabling the control.
 */
export function applyQuantityCap(
  requested: number,
  cap: number,
): { granted: number; limitReached: boolean } {
  const granted = Math.max(0, Math.min(requested, cap));
  return { granted, limitReached: requested > cap };
}

/**
 * Whether the cart is still resolving the details needed to render its items.
 *
 * The stored cart is synchronous (useSyncExternalStore), but rendering an item
 * needs its product and variant, which arrive over the network. Until both land
 * cartWithProducts drops every item, which looks identical to a genuinely empty
 * cart -- this lets the UI tell the two apart instead of falling through to
 * "your cart is empty".
 */
export function deriveCartLoading({
  storedItemCount,
  productsLoading,
  variantsFetched,
  durationsFetched,
}: {
  storedItemCount: number;
  productsLoading: boolean;
  variantsFetched: boolean;
  durationsFetched: boolean;
}): boolean {
  // An actually-empty cart has nothing to wait for and must show its empty
  // state immediately. The detail queries are also `enabled`-gated off in that
  // case, so their isFetched never flips and would otherwise hang here.
  if (storedItemCount === 0) return false;

  // Keyed off whether the fetches have SETTLED, not whether they returned rows.
  // An item whose product was since marked unavailable never resolves
  // (useProducts filters on is_available), so comparing resolved items against
  // cart length would pin the skeleton on forever. isFetched always flips, so a
  // cart of dead items falls through to the empty state rather than hanging.
  return productsLoading || !variantsFetched || !durationsFetched;
}

export function useStaticCart(products: Product[] = [], productsLoading = false) {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { toast } = useToast();

  const cartProductIds = useMemo(() => [...new Set(cart.map((i) => i.product_id))], [cart]);

  const { data: cartVariants = [], isFetched: variantsFetched } = useQuery({
    queryKey: ["cart-variants", cartProductIds],
    enabled: cartProductIds.length > 0,
    queryFn: async (): Promise<ProductVariant[]> => {
      const { data, error } = await supabase
        .from("product_variants")
        .select(
          "id, product_id, name, quantity_value, quantity_unit, price, stock_quantity, max_quantity_per_order, is_default",
        )
        .in("product_id", cartProductIds);
      if (error) throw error;
      return data as ProductVariant[];
    },
  });

  const { data: cartDurations = [], isFetched: durationsFetched } = useQuery({
    queryKey: ["cart-sub-durations", cartProductIds],
    enabled: cartProductIds.length > 0,
    queryFn: async (): Promise<
      { product_id: string; duration_days: number; discount_percent: number }[]
    > => {
      const { data, error } = await supabase
        .from("subscription_durations")
        .select("product_id, duration_days, discount_percent")
        .in("product_id", cartProductIds);
      if (error) throw error;
      return data as { product_id: string; duration_days: number; discount_percent: number }[];
    },
  });

  const addToCart = useCallback(
    (params: {
      productId: string;
      variantId: string;
      quantity: number;
      deliveryType: "one_time" | "subscription";
      subscriptionDuration?: number;
      subscriptionFrequency?: SubscriptionFrequency;
      subscriptionStartDate?: string;
      // Callers that already know the display names (e.g. the product modal)
      // pass them so the toast never has to look them up — avoids "undefined"
      // when the ambient products list is empty or variants haven't fetched yet.
      productName?: string;
      variantName?: string;
    }) => {
      const {
        productId,
        variantId,
        quantity,
        deliveryType,
        subscriptionDuration,
        subscriptionFrequency,
        subscriptionStartDate,
      } = params;
      const itemKey = getItemKey(
        productId,
        variantId,
        deliveryType,
        subscriptionDuration,
        subscriptionFrequency,
      );

      const existing = globalCart.find((item) => {
        return (
          getItemKey(
            item.product_id,
            item.variant_id,
            item.delivery_type,
            item.subscription_duration,
            item.subscription_frequency,
          ) === itemKey
        );
      });

      // Clamp against the variant's own ceiling. The server rejects an
      // over-limit line at checkout regardless; capping here means the customer
      // finds out at the stepper instead of after entering an address.
      const variantForCap = cartVariants.find((v) => v.id === variantId);
      const cap = variantForCap ? resolveQuantityCap(variantForCap) : Number.POSITIVE_INFINITY;

      const requested = existing ? existing.quantity + quantity : quantity;
      const { granted, limitReached } = applyQuantityCap(requested, cap);

      if (existing) {
        globalCart = globalCart.map((item) =>
          getItemKey(
            item.product_id,
            item.variant_id,
            item.delivery_type,
            item.subscription_duration,
            item.subscription_frequency,
          ) === itemKey
            ? { ...item, quantity: granted }
            : item,
        );
      } else {
        globalCart = [
          ...globalCart,
          {
            id: `local_cart_${cartIdCounter++}`,
            product_id: productId,
            variant_id: variantId,
            quantity: granted,
            delivery_type: deliveryType,
            subscription_duration: subscriptionDuration,
            subscription_frequency: subscriptionFrequency,
            subscription_start_date: subscriptionStartDate,
          },
        ];
      }

      emitChange();

      const productName =
        params.productName ?? products.find((p) => p.id === productId)?.name ?? "Item";
      const variantName = params.variantName ?? cartVariants.find((v) => v.id === variantId)?.name;
      const label = variantName ? `${productName} (${variantName})` : productName;

      if (limitReached) {
        // The quantity did not move, so "Added to cart" would be a lie. Name the
        // cap: unlike a stock-derived ceiling, this is a deliberate rule, and
        // the number is the first thing a customer asks for.
        toast({
          title: `Max ${cap} per order`,
          description: `You can't add more of this item.`,
          variant: "destructive",
        });
      } else if (deliveryType === "subscription") {
        toast({
          title: "Subscription added",
          description: `${label} - ${subscriptionDuration} deliveries`,
        });
      } else {
        toast({ title: "Added to cart", description: `${label} added to your basket.` });
      }
    },
    [toast, cartVariants, products],
  );

  const addToCartSimple = useCallback(
    (productId: string, variantId: string, quantity = 1) => {
      addToCart({ productId, variantId, quantity, deliveryType: "one_time" });
    },
    [addToCart],
  );

  const updateQuantity = useCallback(
    (cartItemId: string, quantity: number) => {
      if (quantity <= 0) {
        globalCart = globalCart.filter((i) => i.id !== cartItemId);
        emitChange();
        return;
      }

      let refusedCap: number | null = null;
      globalCart = globalCart.map((item) => {
        if (item.id !== cartItemId) return item;
        const variant = cartVariants.find((v) => v.id === item.variant_id);
        const cap = variant ? resolveQuantityCap(variant) : Number.POSITIVE_INFINITY;
        const { granted, limitReached } = applyQuantityCap(quantity, cap);
        if (limitReached) refusedCap = cap;
        return { ...item, quantity: granted };
      });

      emitChange();

      // The stepper stays enabled at the cap (see Cart.tsx), so a refused tap
      // reaches here and must explain itself rather than doing nothing.
      if (refusedCap !== null) {
        toast({
          title: `Max ${refusedCap} per order`,
          description: `You can't add more of this item.`,
          variant: "destructive",
        });
      }
    },
    [cartVariants, toast],
  );

  const removeFromCart = useCallback((cartItemId: string) => {
    globalCart = globalCart.filter((item) => item.id !== cartItemId);
    emitChange();
  }, []);

  const updateSubscriptionItem = useCallback(
    (
      cartItemId: string,
      updates: {
        variantId: string;
        subscriptionDuration: number;
        subscriptionFrequency: SubscriptionFrequency;
        subscriptionStartDate?: string;
        productName?: string;
        variantName?: string;
      },
    ) => {
      const existing = globalCart.find((item) => item.id === cartItemId);
      if (!existing) return;

      globalCart = globalCart.map((item) =>
        item.id === cartItemId
          ? {
              ...item,
              variant_id: updates.variantId,
              subscription_duration: updates.subscriptionDuration,
              subscription_frequency: updates.subscriptionFrequency,
              subscription_start_date: updates.subscriptionStartDate,
            }
          : item,
      );
      emitChange();

      const productName =
        updates.productName ?? products.find((p) => p.id === existing.product_id)?.name ?? "Item";
      const variantName =
        updates.variantName ?? cartVariants.find((v) => v.id === updates.variantId)?.name;
      const label = variantName ? `${productName} (${variantName})` : productName;
      toast({
        title: "Subscription updated",
        description: `${label} - ${updates.subscriptionDuration} deliveries`,
      });
    },
    [toast, cartVariants, products],
  );

  const clearCart = useCallback(() => {
    globalCart = [];
    emitChange();
  }, []);

  const getQuantity = useCallback(
    (productId: string): number => {
      return cart
        .filter((i) => i.product_id === productId)
        .reduce((sum, item) => sum + item.quantity, 0);
    },
    [cart],
  );

  const cartWithProducts = useMemo((): CartItemWithDetails[] => {
    const result: CartItemWithDetails[] = [];
    for (const item of cart) {
      const product = products.find((p) => p.id === item.product_id);
      const variant = cartVariants.find((v) => v.id === item.variant_id);
      if (!product || !variant) continue;

      let itemTotal = variant.price * item.quantity;
      let deliveryCount: number | undefined;
      let discountPercent: number | undefined;

      if (
        item.delivery_type === "subscription" &&
        item.subscription_duration &&
        item.subscription_frequency
      ) {
        // subscription_duration is the chosen number of deliveries, independent of frequency.
        deliveryCount = item.subscription_duration;
        discountPercent = cartDurations.find(
          (d) => d.product_id === item.product_id && d.duration_days === item.subscription_duration,
        )?.discount_percent;
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
        subscription_start_date: item.subscription_start_date,
        product,
        variant,
        max_quantity: resolveQuantityCap(variant),
        item_total: itemTotal,
        delivery_count: deliveryCount,
        discount_percent: discountPercent,
      });
    }
    return result;
  }, [cart, products, cartVariants, cartDurations]);

  const isCartLoading = deriveCartLoading({
    storedItemCount: cart.length,
    productsLoading,
    variantsFetched,
    durationsFetched,
  });

  const cartTotal = useMemo(
    () => cartWithProducts.reduce((t, item) => t + item.item_total, 0),
    [cartWithProducts],
  );
  const cartCount = useMemo(() => cart.reduce((c, item) => c + item.quantity, 0), [cart]);

  return {
    cart,
    isCartLoading,
    addToCart,
    addToCartSimple,
    updateQuantity,
    removeFromCart,
    updateSubscriptionItem,
    clearCart,
    getQuantity,
    getCartWithProducts: () => cartWithProducts,
    getCartTotal: () => cartTotal,
    getCartCount: () => cartCount,
  };
}
