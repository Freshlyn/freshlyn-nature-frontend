import { useQuery, queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type SubscriptionFrequency = 'daily' | 'alternate' | 'every_3rd';

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
    daily: 'Everyday',
    alternate: 'Every 2 days',
    every_3rd: 'Every 3 days',
  };
  return labels[frequency];
}

export function getFrequencyIntervalDays(frequency: SubscriptionFrequency): number {
  const intervals: Record<SubscriptionFrequency, number> = {
    daily: 1,
    alternate: 2,
    every_3rd: 3,
  };
  return intervals[frequency];
}

export function useProducts(options?: { category?: string; search?: string }) {
  const category = options?.category;
  const search = options?.search;
  return useQuery({
    queryKey: ['products', category ?? 'all', search ?? ''],
    queryFn: async (): Promise<Product[]> => {
      let query = supabase
        .from('products')
        .select('id, name, description, category, image_url, unit, is_available, created_at')
        .eq('is_available', true);
      if (category) query = query.eq('category', category);
      if (search) query = query.ilike('name', `%${search}%`);
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data as Product[];
    },
  });
}

export interface ProductWithMeta extends Product {
  startingPrice: number;
  hasSubscription: boolean;
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
    queryKey: ['products-with-meta', category ?? 'all', search ?? ''],
    queryFn: async (): Promise<ProductWithMeta[]> => {
      let query = supabase
        .from('products')
        .select('id, name, description, category, image_url, unit, is_available, created_at')
        .eq('is_available', true);
      if (category) query = query.eq('category', category);
      if (search) query = query.ilike('name', `%${search}%`);
      const { data: products, error } = await query.order('name');
      if (error) throw error;

      const typedProducts = (products ?? []) as Product[];
      if (typedProducts.length === 0) return [];

      const ids = typedProducts.map((p) => p.id);

      const [{ data: variants, error: variantsError }, { data: configs, error: configsError }] = await Promise.all([
        supabase
          .from('product_variants')
          .select('product_id, price')
          .in('product_id', ids),
        supabase
          .from('subscription_configs')
          .select('product_id, enabled')
          .in('product_id', ids),
      ]);
      if (variantsError) throw variantsError;
      if (configsError) throw configsError;

      const minPriceByProduct = new Map<string, number>();
      for (const v of (variants ?? []) as { product_id: string; price: number }[]) {
        const current = minPriceByProduct.get(v.product_id);
        if (current === undefined || v.price < current) minPriceByProduct.set(v.product_id, v.price);
      }

      const subscriptionEnabled = new Set<string>();
      for (const c of (configs ?? []) as { product_id: string; enabled: boolean }[]) {
        if (c.enabled) subscriptionEnabled.add(c.product_id);
      }

      return typedProducts.map((p) => ({
        ...p,
        startingPrice: minPriceByProduct.get(p.id) ?? 0,
        hasSubscription: subscriptionEnabled.has(p.id),
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
    queryKey: ['product', id],
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // reopening the same product is instant, no refetch
    queryFn: async (): Promise<ProductWithVariants | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('products')
        .select(
          `id, name, description, category, image_url, unit, is_available, created_at,
           product_variants(id, product_id, name, quantity_value, quantity_unit, price, stock_quantity, max_quantity_per_order, is_default),
           subscription_configs(enabled, frequencies,
             subscription_durations(duration_days, label, discount_percent))`,
        )
        .eq('id', id)
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

      const startingPrice = typedVariants.length > 0 ? Math.min(...typedVariants.map((v) => v.price)) : 0;

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
