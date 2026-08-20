import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useInfiniteOrders } from "@/hooks/use-orders";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { ORDERS_PAGE_SIZE } from "@/lib/order-query";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/Header";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import OrderFilters, {
  DEFAULT_ORDER_FILTERS,
  hasActiveOrderFilters,
} from "@/components/orders/OrderFilters";
import { OrderCardTracker as OrderCard } from "@/components/orders/OrderCard";

interface OrdersProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

export default function Orders({ sidebarOpen, onSidebarToggle }: OrdersProps) {
  const [filters, setFilters] = useState(DEFAULT_ORDER_FILTERS);
  const queryClient = useQueryClient();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, isError, refetch } =
    useInfiniteOrders(filters);

  const orders = useMemo(() => data?.pages.flatMap((page) => page.orders) ?? [], [data]);
  const filtersActive = hasActiveOrderFilters(filters);

  // `enabled` gates the observer rather than the callback: while a page is in
  // flight the sentinel stays on screen, and an attached observer would keep
  // firing for every scroll tick.
  const sentinelRef = useIntersectionObserver<HTMLDivElement>({
    onIntersect: () => fetchNextPage(),
    enabled: hasNextPage && !isFetchingNextPage && !isError,
  });

  // A payment that is authorized and later reversed is corrected by the webhook
  // seconds after the customer already saw "Order placed!". Without this, a
  // customer sitting on this page would keep seeing stale state.
  //
  // Requires public.orders to be a member of the supabase_realtime publication
  // (migration 20260731090400) -- without it this subscribes successfully and
  // silently receives nothing.
  useEffect(() => {
    const channel = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        // Prefix match: invalidates every filter combination's cached pages.
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-muted/10">
      <Header
        sidebarOpen={sidebarOpen}
        onSidebarToggle={onSidebarToggle}
        backTo="/"
        backLabel="Back to Shop"
      />
      <main className="container mx-auto px-4 py-6 max-w-2xl pb-28 md:pb-6">
        <h1 className="text-2xl font-display font-bold mb-4" data-testid="text-orders-title">
          Your Orders
        </h1>

        {!isLoading && (orders.length > 0 || filtersActive) && (
          <OrderFilters value={filters} onChange={setFilters} />
        )}

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
        ) : orders.length === 0 && !filtersActive ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-border shadow-sm">
            <ShoppingBag size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold text-foreground" data-testid="text-no-orders">
              No orders yet
            </h2>
            <p className="text-muted-foreground mt-2 mb-8">
              Start shopping to place your first order.
            </p>
            <Link href="/">
              <Button
                size="lg"
                className="rounded-xl px-8 font-bold"
                data-testid="button-start-shopping"
              >
                Start Shopping
              </Button>
            </Link>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-border shadow-sm">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-lg font-bold text-foreground" data-testid="text-no-filtered-orders">
              No orders match these filters
            </h2>
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
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}

            {isFetchingNextPage &&
              Array.from({ length: 2 }).map((_, i) => (
                <Card
                  key={`next-${i}`}
                  className="overflow-hidden rounded-3xl p-0 border-border/40"
                  data-testid="orders-next-page-skeleton"
                >
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
                      <div className="flex -space-x-2.5 flex-shrink-0">
                        <Skeleton className="w-10 h-10 rounded-xl border-2 border-white" />
                        <Skeleton className="w-10 h-10 rounded-xl border-2 border-white" />
                        <Skeleton className="w-10 h-10 rounded-xl border-2 border-white" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </div>
                </Card>
              ))}

            {/* A failed page must not silently end the list -- the user needs a
                way back without losing the pages already scrolled. */}
            {isError && hasNextPage && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">Could not load more orders.</p>
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  className="rounded-xl"
                  data-testid="button-retry-orders"
                >
                  Try again
                </Button>
              </div>
            )}

            {/* Sits below the list; scrolling it into view pulls the next page. */}
            <div ref={sentinelRef} aria-hidden="true" data-testid="orders-scroll-sentinel" />

            {/* {!hasNextPage && orders.length > ORDERS_PAGE_SIZE && (
              <p
                className="text-center text-sm text-muted-foreground py-4"
                data-testid="text-orders-end"
              >
                You have reached the end of your orders.
              </p>
            )} */}
          </div>
        )}
      </main>
    </div>
  );
}
