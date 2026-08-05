import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOrders } from '@/hooks/use-orders';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/Header';
import { MobileBackButton } from '@/components/MobileBackButton';
import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import OrderFilters, { DEFAULT_ORDER_FILTERS, hasActiveOrderFilters } from '@/components/orders/OrderFilters';
import { filterOrders } from '@/lib/order-filters';
import { OrderCardTracker as OrderCard } from '@/components/orders/OrderCard';

interface OrdersProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

export default function Orders({ sidebarOpen, onSidebarToggle }: OrdersProps) {
  const { data: orders = [], isLoading } = useOrders();
  const [filters, setFilters] = useState(DEFAULT_ORDER_FILTERS);
  const queryClient = useQueryClient();

  const filteredOrders = useMemo(() => filterOrders(orders, filters), [orders, filters]);
  const filtersActive = hasActiveOrderFilters(filters);

  // A payment that is authorized and later reversed is corrected by the webhook
  // seconds after the customer already saw "Order placed!". Without this, a
  // customer sitting on this page would keep seeing stale state.
  //
  // Requires public.orders to be a member of the supabase_realtime publication
  // (migration 20260731090400) -- without it this subscribes successfully and
  // silently receives nothing.
  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-muted/10">
      <Header sidebarOpen={sidebarOpen} onSidebarToggle={onSidebarToggle} />
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <MobileBackButton to="/" label="Back to Shop" />
        <h1 className="text-2xl font-display font-bold mb-4" data-testid="text-orders-title">Your Orders</h1>

        {!isLoading && orders.length > 0 && <OrderFilters value={filters} onChange={setFilters} />}

        {isLoading ? (
          <div className="flex flex-col gap-5" data-testid="orders-skeleton">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="overflow-hidden rounded-3xl p-0 border-border/40">
                {/* Status strip */}
                <div className="px-4 py-2 flex items-center justify-between bg-muted/50">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    {/* Item thumbnails */}
                    <div className="flex -space-x-2.5 flex-shrink-0">
                      <Skeleton className="w-10 h-10 rounded-xl border-2 border-white" />
                      <Skeleton className="w-10 h-10 rounded-xl border-2 border-white" />
                      <Skeleton className="w-10 h-10 rounded-xl border-2 border-white" />
                    </div>
                  </div>
                  {/* Total row */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-border shadow-sm">
            <ShoppingBag size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold text-foreground" data-testid="text-no-orders">No orders yet</h2>
            <p className="text-muted-foreground mt-2 mb-8">Start shopping to place your first order.</p>
            <Link href="/">
              <Button size="lg" className="rounded-xl px-8 font-bold" data-testid="button-start-shopping">
                Start Shopping
              </Button>
            </Link>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-border shadow-sm">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-lg font-bold text-foreground" data-testid="text-no-filtered-orders">No orders match these filters</h2>
            <p className="text-muted-foreground mt-2 mb-6 text-sm">Try adjusting your filters.</p>
            {filtersActive && (
              <Button
                variant="outline"
                onClick={() => setFilters(DEFAULT_ORDER_FILTERS)}
                className="rounded-xl border-primary/30 text-primary hover:bg-primary hover:text-white"
                data-testid="button-clear-order-filters"
              >
                Clear all filters
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
