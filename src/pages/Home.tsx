import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { HomeBanner, HomeBannerSkeleton } from "@/components/HomeBanner";
import { useProductsWithMeta } from "@/hooks/use-products";
import { useStaticCart } from "@/hooks/use-static-cart";
import { useDebounce } from "@/hooks/use-debounce";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { LocationModal } from "@/components/LocationModal";
import {
  readLocationPreference,
  writeLocationPreference,
  type LocationPreference,
} from "@/lib/location-preference";
import type { Product, SubscriptionFrequency } from "@/hooks/use-products";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORIES = [
  { id: "all", name: "All", icon: "🛒" },
  { id: "dairy", name: "Dairy", icon: "🥛" },
  { id: "bakery", name: "Bakery", icon: "🍞" },
  { id: "produce", name: "Vegetables", icon: "🥬" },
  { id: "pantry", name: "Pantry", icon: "🍚" },
  { id: "snacks", name: "Snacks", icon: "🍪" },
  { id: "beverages", name: "Beverages", icon: "🧃" },
];

interface HomeProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

export default function Home({ sidebarOpen, onSidebarToggle }: HomeProps) {
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebounce(search, 300);
  const [preference, setPreference] = useState<LocationPreference | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const location = preference?.label ?? "Set Location";
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);

  // Shown ONCE per device. A stored preference -- including a stored rejection
  // -- means the question has been answered and the screen stays closed; the
  // header then shows the answer with a tap to change it.
  useEffect(() => {
    let cancelled = false;
    readLocationPreference()
      .then((stored) => {
        if (cancelled) return;
        if (stored) {
          setPreference(stored);
        } else {
          setLocationModalOpen(true);
        }
      })
      .catch(() => {
        // Failing to READ the preference must SHOW the screen, not skip it --
        // on native this goes through Capacitor Preferences.get, which can
        // reject, and an unhandled rejection here would otherwise leave
        // neither branch run: the modal never opens and the header is stuck
        // showing "Set Location" forever.
        if (cancelled) return;
        setLocationModalOpen(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { data: products, isLoading: loadingProducts } = useProductsWithMeta({
    category: category === "all" ? undefined : category,
    search: debouncedSearch || undefined,
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
    deliveryType: "one_time" | "subscription";
    subscriptionDuration?: number;
    subscriptionFrequency?: SubscriptionFrequency;
    subscriptionStartDate?: string;
    productName?: string;
    variantName?: string;
  }) => {
    addToCart(params);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 pb-24">
      <Header
        onSearch={setSearch}
        location={location}
        onLocationClick={() => setLocationModalOpen(true)}
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
        {loadingProducts ? <HomeBannerSkeleton /> : <HomeBanner />}

        {loadingProducts ? (
          <div
            className="mb-5 md:mb-8 overflow-x-auto -mx-3 px-3 md:-mx-4 md:px-4 no-scrollbar"
            data-testid="categories-skeleton"
          >
            <div className="flex gap-2 min-w-max pb-1">
              {CATEGORIES.map((cat) => (
                <Skeleton key={cat.id} className="h-9 md:h-10 w-20 md:w-24 rounded-xl" />
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-5 md:mb-8 overflow-x-auto -mx-3 px-3 md:-mx-4 md:px-4 no-scrollbar">
            <div className="flex gap-2 min-w-max pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  data-testid={`category-${cat.id}`}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-semibold text-xs md:text-sm transition-all duration-300 border whitespace-nowrap ${
                    category === cat.id
                      ? "bg-primary text-white border-primary shadow-lg shadow-primary/30 scale-105"
                      : "bg-white text-muted-foreground border-border hover:border-primary/30 hover:text-foreground hover:shadow-md active:scale-95"
                  }`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {loadingProducts ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-32" />
            </div>
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5"
              data-testid="product-grid-skeleton"
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          </>
        ) : products?.length === 0 ? (
          <div className="text-center py-16 md:py-20 bg-gradient-to-b from-muted/30 to-muted/10 rounded-3xl border border-dashed border-muted-foreground/20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-muted-foreground" data-testid="text-no-products">
              No products found
            </h3>
            <p className="text-sm text-muted-foreground/70 mt-2 max-w-xs mx-auto">
              Try adjusting your search or category filters
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setCategory("all");
                setSearch("");
              }}
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
                {category === "all"
                  ? "All Products"
                  : CATEGORIES.find((c) => c.id === category)?.name}
              </h2>
            </div>
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5"
              data-testid="product-grid"
            >
              {products?.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  startingPrice={product.startingPrice}
                  hasSubscription={product.hasSubscription}
                  quantity={getQuantity(product.id)}
                  outOfStock={product.outOfStock}
                  onAdd={() => handleProductClick(product)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <LocationModal
        open={locationModalOpen}
        onOpenChange={setLocationModalOpen}
        onResolved={(pref) => {
          // A null result is a skip: store nothing, so the question can be
          // asked again next launch. Nothing here influences checkout either
          // way -- the address row is what decides an order.
          if (!pref) return;
          setPreference(pref);
          void writeLocationPreference(pref);
        }}
      />
    </div>
  );
}
