import { useQuery } from '@tanstack/react-query';
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

export function useProduct(id: string | null) {
  return useQuery({
    queryKey: ['product', id],
    enabled: !!id,
    queryFn: async (): Promise<ProductWithVariants | null> => {
      if (!id) return null;

      const [{ data: product, error: productError }, { data: variants, error: variantsError }] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, description, category, image_url, unit, is_available, created_at')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('product_variants')
          .select('id, product_id, name, quantity_value, quantity_unit, price, stock_quantity, max_quantity_per_order, is_default')
          .eq('product_id', id)
          .order('price'),
      ]);
      if (productError) throw productError;
      if (variantsError) throw variantsError;
      if (!product) return null;

      const { data: config } = await supabase
        .from('subscription_configs')
        .select('product_id, enabled, frequencies')
        .eq('product_id', id)
        .maybeSingle();

      let subscriptionConfig: ProductSubscriptionConfig | null = null;
      if (config?.enabled) {
        const { data: durations } = await supabase
          .from('subscription_durations')
          .select('duration_days, label, discount_percent')
          .eq('product_id', id)
          .order('duration_days');
        subscriptionConfig = {
          product_id: id,
          enabled: config.enabled,
          durations: (durations ?? []) as SubscriptionOption[],
          frequencies: (config.frequencies ?? []) as SubscriptionFrequency[],
        };
      }

      const typedVariants = (variants ?? []) as ProductVariant[];
      const startingPrice = typedVariants.length > 0 ? Math.min(...typedVariants.map((v) => v.price)) : 0;

      return { ...(product as Product), variants: typedVariants, subscriptionConfig, startingPrice };
    },
  });
}
