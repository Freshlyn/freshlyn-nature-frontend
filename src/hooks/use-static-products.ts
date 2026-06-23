import { useMemo } from 'react';
import type { Product } from '@/data/products';
import { products, searchProducts, getProductsByCategory } from '@/data/products';

interface UseStaticProductsOptions {
  category?: string;
  search?: string;
}

export function useStaticProducts(options?: UseStaticProductsOptions) {
  const data = useMemo((): Product[] => {
    const { category, search } = options || {};
    if (search) return searchProducts(search, category);
    return getProductsByCategory(category || 'all');
  }, [options?.category, options?.search]);

  return { data, isLoading: false, error: null };
}

export function useStaticProduct(id: string | null) {
  const data = useMemo(() => {
    if (!id) return null;
    return products.find((p) => p.id === id) || null;
  }, [id]);

  return { data, isLoading: false, error: null };
}
