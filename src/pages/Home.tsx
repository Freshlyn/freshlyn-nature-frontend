import { useState } from 'react';
import { Header } from '@/components/Header';
import { ProductCard } from '@/components/ProductCard';
import { useStaticProducts } from '@/hooks/use-static-products';
import { useStaticCart } from '@/hooks/use-static-cart';
import { ProductDetailModal } from '@/components/ProductDetailModal';
import type { Product } from '@/data/products';
import type { SubscriptionFrequency } from '@/data/product_variants';
import { Loader2, Truck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🛒' },
  { id: 'dairy', name: 'Dairy', icon: '🥛' },
  { id: 'bakery', name: 'Bakery', icon: '🍞' },
  { id: 'produce', name: 'Vegetables', icon: '🥬' },
  { id: 'pantry', name: 'Pantry', icon: '🍚' },
  { id: 'snacks', name: 'Snacks', icon: '🍪' },
  { id: 'beverages', name: 'Beverages', icon: '🧃' },
];

interface HomeProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

export default function Home({ sidebarOpen, onSidebarToggle }: HomeProps) {
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [location, setLocation] = useState('Set Location');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);

  const { data: products, isLoading: loadingProducts } = useStaticProducts({
    category: category === 'all' ? undefined : category,
    search: search || undefined,
  });

  const { addToCart, getQuantity } = useStaticCart();

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setProductModalOpen(true);
  };

  const handleAddToCart = (params: {
    productId: string;
    variantId: string;
    quantity: number;
    deliveryType: 'one_time' | 'subscription';
    subscriptionDuration?: number;
    subscriptionFrequency?: SubscriptionFrequency;
  }) => {
    addToCart(params);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 pb-24">
      <Header
        onSearch={setSearch}
        location={location}
        sidebarOpen={sidebarOpen}
        onSidebarToggle={onSidebarToggle}
      />

      <ProductDetailModal
        product={selectedProduct}
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
        onAddToCart={handleAddToCart}
      />

      <main className="container mx-auto px-3 md:px-4 pt-4 md:pt-6">
        <div className="relative rounded-2xl md:rounded-3xl overflow-hidden mb-5 md:mb-8 bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-300 rounded-full blur-3xl" />
          </div>
          <div className="relative p-5 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
              <div className="flex-1 text-center md:text-left space-y-3 md:space-y-4">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold leading-tight text-white">
                  Fresh Groceries,<br />
                  <span className="text-yellow-300">Delivered Fast</span>
                </h1>
                <p className="text-sm md:text-base text-white/90 max-w-md">
                  Get your daily essentials delivered to your doorstep in minutes
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-medium">
                    <Truck size={14} />
                    <span>Free over $50</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-medium">
                    <Clock size={14} />
                    <span>30 min</span>
                  </div>
                </div>
              </div>

              <div className="hidden md:block relative">
                <div className="w-36 lg:w-48 h-36 lg:h-48 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/30 rotate-3 hover:rotate-0 transition-transform">
                  <img
                    src="https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop"
                    alt="Fresh Fruits"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 md:mb-8 overflow-x-auto -mx-3 px-3 md:-mx-4 md:px-4 no-scrollbar">
          <div className="flex gap-2 min-w-max pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                data-testid={`category-${cat.id}`}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-semibold text-xs md:text-sm transition-all duration-300 border whitespace-nowrap ${
                  category === cat.id
                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30 scale-105'
                    : 'bg-white text-muted-foreground border-border hover:border-primary/30 hover:text-foreground hover:shadow-md active:scale-95'
                }`}
              >
                <span className="text-base">{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {loadingProducts ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary/10 animate-ping absolute inset-0" />
              <Loader2 className="animate-spin text-primary w-16 h-16 relative" />
            </div>
            <p className="text-muted-foreground text-sm animate-pulse">Loading fresh products...</p>
          </div>
        ) : products?.length === 0 ? (
          <div className="text-center py-16 md:py-20 bg-gradient-to-b from-muted/30 to-muted/10 rounded-3xl border border-dashed border-muted-foreground/20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-muted-foreground" data-testid="text-no-products">No products found</h3>
            <p className="text-sm text-muted-foreground/70 mt-2 max-w-xs mx-auto">Try adjusting your search or category filters</p>
            <Button
              variant="outline"
              onClick={() => { setCategory('all'); setSearch(''); }}
              className="mt-6 rounded-xl border-primary/30 text-primary hover:bg-primary hover:text-white"
              data-testid="button-clear-filters"
            >
              Clear all filters
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg md:text-xl font-display font-bold text-foreground">
                {category === 'all' ? 'All Products' : CATEGORIES.find((c) => c.id === category)?.name}
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5" data-testid="product-grid">
              {products?.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={getQuantity(product.id)}
                  onAdd={() => handleProductClick(product)}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
