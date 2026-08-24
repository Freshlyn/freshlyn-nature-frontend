import { useQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type SubscriptionFrequency = "daily" | "alternate";

export interface SubscriptionOption {
  duration_days: number;
  label: string;
  discount_percent: number;
}

export interface ProductSubscriptionConfig {
  product_id: string;
  enabled: boolean;
  durations: SubscriptionOption[];
  frequencies: SubscriptionFrequency[];
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  unit: string;
  is_available: boolean;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  quantity_value: number;
  quantity_unit: string;
  price: number;
  stock_quantity: number;
  max_quantity_per_order: number;
  is_default: boolean;
}

export interface ProductWithVariants extends Product {
  variants: ProductVariant[];
  subscriptionConfig: ProductSubscriptionConfig | null;
  startingPrice: number;
}

export function getFrequencyLabel(frequency: SubscriptionFrequency): string {
  const labels: Record<SubscriptionFrequency, string> = {
    daily: "Everyday",
    alternate: "Every 2 days",
  };
  return labels[frequency];
}

export function getFrequencyIntervalDays(frequency: SubscriptionFrequency): number {
  const intervals: Record<SubscriptionFrequency, number> = {
    daily: 1,
    alternate: 2,
  };
  return intervals[frequency];
}

export function useProducts(options?: { category?: string; search?: string }) {
  const category = options?.category;
  const search = options?.search;
  return useQuery({
    queryKey: ["products", category ?? "all", search ?? ""],
    queryFn: async (): Promise<Product[]> => {
      let query = supabase
        .from("products")
        .select("id, name, description, category, image_url, unit, is_available, created_at")
        .eq("is_available", true);
      if (category) query = query.eq("category", category);
      if (search) query = query.ilike("name", `%${search}%`);
      const { data, error } = await query.order("name");
      if (error) throw error;
      return data as Product[];
    },
  });
}

export interface ProductWithMeta extends Product {
  startingPrice: number;
  hasSubscription: boolean;
  /** True when every variant is sold out; see isOutOfStock. */
  outOfStock: boolean;
}

/**
 * Whether a variant can still be bought.
 *
 * Derived from stock, not stored: a boolean column would duplicate state that
 * every decrement path (checkout RPC, webhook, delivery trigger) would then
 * have to keep in sync. The column is NOT NULL in the database, so a missing
 * value means a client-side hole (a cached or partially-mapped variant) rather
 * than "none left" -- treat it as available and let the server's 409 decide.
 */
export function isVariantOutOfStock(variant: { stock_quantity?: number }): boolean {
  return variant.stock_quantity !== undefined && variant.stock_quantity <= 0;
}

/**
 * Whether a product is unbuyable in EVERY size.
 *
 * A product with one sold-out size is still a sale, so the grid card only
 * stamps when nothing on it can be bought -- matching Blinkit/Zepto, which
 * leave partially-stocked tiles looking normal and reveal the gap inside the
 * detail sheet. An empty variant list is NOT out of stock: that is a product
 * whose variants failed to load, and stamping it would hide a working product.
 */
export function isProductOutOfStock(variants: { stock_quantity?: number }[]): boolean {
  return variants.length > 0 && variants.every(isVariantOutOfStock);
}

/**
 * Batched variant of useProducts for list views (e.g. the home grid).
 *
 * Instead of each card fetching its own variants/subscription config (an N+1
 * that fired ~3-4 requests per product), this fetches the product list plus
 * all variants and all subscription configs for those products in 3 total
 * queries, then computes startingPrice/hasSubscription in memory.
 */
export function useProductsWithMeta(options?: { category?: string; search?: string }) {
  const category = options?.category;
  const search = options?.search;
  return useQuery({
    queryKey: ["products-with-meta", category ?? "all", search ?? ""],
    queryFn: async (): Promise<ProductWithMeta[]> => {
      let query = supabase
        .from("products")
        .select("id, name, description, category, image_url, unit, is_available, created_at")
        .eq("is_available", true);
      if (category) query = query.eq("category", category);
      if (search) query = query.ilike("name", `%${search}%`);
      const { data: products, error } = await query.order("name");
      if (error) throw error;

      const typedProducts = (products ?? []) as Product[];
      if (typedProducts.length === 0) return [];

      const ids = typedProducts.map((p) => p.id);

      const [{ data: variants, error: variantsError }, { data: configs, error: configsError }] =
        await Promise.all([
          supabase
            .from("product_variants")
            .select("product_id, price, stock_quantity")
            .in("product_id", ids),
          supabase.from("subscription_configs").select("product_id, enabled").in("product_id", ids),
        ]);
      if (variantsError) throw variantsError;
      if (configsError) throw configsError;

      const minPriceByProduct = new Map<string, number>();
      const variantsByProduct = new Map<string, { stock_quantity: number }[]>();
      for (const v of (variants ?? []) as {
        product_id: string;
        price: number;
        stock_quantity: number;
      }[]) {
        const current = minPriceByProduct.get(v.product_id);
        if (current === undefined || v.price < current)
          minPriceByProduct.set(v.product_id, v.price);

        const group = variantsByProduct.get(v.product_id);
        if (group) group.push({ stock_quantity: v.stock_quantity });
        else variantsByProduct.set(v.product_id, [{ stock_quantity: v.stock_quantity }]);
      }

      const subscriptionEnabled = new Set<string>();
      for (const c of (configs ?? []) as { product_id: string; enabled: boolean }[]) {
        if (c.enabled) subscriptionEnabled.add(c.product_id);
      }

      return typedProducts.map((p) => ({
        ...p,
        startingPrice: minPriceByProduct.get(p.id) ?? 0,
        hasSubscription: subscriptionEnabled.has(p.id),
        outOfStock: isProductOutOfStock(variantsByProduct.get(p.id) ?? []),
      }));
    },
  });
}

// Shape of the single nested-select response. subscription_durations FKs to
// subscription_configs(product_id), so it embeds under the config.
interface ProductDetailRow extends Product {
  product_variants: ProductVariant[] | null;
  subscription_configs: {
    enabled: boolean;
    frequencies: string[] | null;
    subscription_durations: SubscriptionOption[] | null;
  } | null;
}

/**
 * Shared query definition for a single product's full detail (variants +
 * subscription config + durations). Fetched in ONE PostgREST request via
 * embedded resources, so both the detail modal (useProduct) and the card's
 * hover/tap prefetch resolve the same cache entry.
 */
export function productDetailQuery(id: string | null) {
  return queryOptions({
    queryKey: ["product", id],
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // reopening the same product is instant, no refetch
    queryFn: async (): Promise<ProductWithVariants | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("products")
        .select(
          `id, name, description, category, image_url, unit, is_available, created_at,
           product_variants(id, product_id, name, quantity_value, quantity_unit, price, stock_quantity, max_quantity_per_order, is_default),
           subscription_configs(enabled, frequencies,
             subscription_durations(duration_days, label, discount_percent))`,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const row = data as unknown as ProductDetailRow;

      const typedVariants = [...(row.product_variants ?? [])].sort((a, b) => a.price - b.price);

      let subscriptionConfig: ProductSubscriptionConfig | null = null;
      const config = row.subscription_configs;
      if (config?.enabled) {
        const durations = [...(config.subscription_durations ?? [])].sort(
          (a, b) => a.duration_days - b.duration_days,
        );
        subscriptionConfig = {
          product_id: id,
          enabled: config.enabled,
          durations: durations as SubscriptionOption[],
          frequencies: (config.frequencies ?? []) as SubscriptionFrequency[],
        };
      }

      const startingPrice =
        typedVariants.length > 0 ? Math.min(...typedVariants.map((v) => v.price)) : 0;

      const product: Product = {
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        image_url: row.image_url,
        unit: row.unit,
        is_available: row.is_available,
        created_at: row.created_at,
      };
      return { ...product, variants: typedVariants, subscriptionConfig, startingPrice };
    },
  });
}

export function useProduct(id: string | null) {
  return useQuery(productDetailQuery(id));
}
