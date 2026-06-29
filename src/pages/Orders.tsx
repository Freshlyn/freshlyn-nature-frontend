import { useMemo, useState } from 'react';
import type { OrderWithItems } from '@/hooks/use-static-orders';
import { useStaticOrders } from '@/hooks/use-static-orders';
import { Header } from '@/components/Header';
import { MobileBackButton } from '@/components/MobileBackButton';
import { format } from 'date-fns';
import { Package, Clock, CheckCircle, Truck, XCircle, ChevronRight, RefreshCw, ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from 'wouter';
import OrderFilters, { DEFAULT_ORDER_FILTERS, hasActiveOrderFilters } from '@/components/orders/OrderFilters';
import { filterOrders } from '@/lib/order-filters';

const statusConfig: Record<string, { icon: typeof Clock; label: string; variant: string }> = {
  pending: { icon: Clock, label: 'Pending', variant: 'secondary' },
  confirmed: { icon: CheckCircle, label: 'Confirmed', variant: 'default' },
  preparing: { icon: Package, label: 'Preparing', variant: 'default' },
  out_for_delivery: { icon: Truck, label: 'On the way', variant: 'default' },
  delivered: { icon: CheckCircle, label: 'Delivered', variant: 'default' },
  cancelled: { icon: XCircle, label: 'Cancelled', variant: 'destructive' },
};

interface OrdersProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

function OrderCard({ order }: { order: OrderWithItems }) {
  const config = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const hasSubscription = order.items.some((item) => item.delivery_type === 'subscription');
  const thumbnails = order.items.slice(0, 3).filter((item) => item.product);

  return (
    <Link href={`/orders/${order.id}`}>
      <Card className="p-4 hover-elevate cursor-pointer" data-testid={`order-card-${order.id}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-foreground" data-testid={`text-order-id-${order.id}`}>
                #{order.id.replace('ord_', '')}
              </span>
              <Badge variant={config.variant as any} className="capitalize text-xs">
                <StatusIcon size={10} className="mr-1" />
                {config.label}
              </Badge>
              {hasSubscription && (
                <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 bg-emerald-50">
                  <RefreshCw size={10} className="mr-1" />
                  Subscription
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-1.5">
              {format(new Date(order.created_at), "MMM d, yyyy 'at' h:mm a")}
            </p>

            <div className="flex items-center gap-2 mt-3">
              <div className="flex -space-x-2">
                {thumbnails.map((item) => (
                  <div key={item.id} className="w-8 h-8 rounded-md overflow-hidden border-2 border-white bg-muted flex-shrink-0">
                    <img src={item.product!.image_url} alt={item.product!.name} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {order.item_count} {order.item_count === 1 ? 'item' : 'items'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-base whitespace-nowrap" data-testid={`text-order-total-${order.id}`}>
              ${order.total.toFixed(2)}
            </span>
            <ChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function Orders({ sidebarOpen, onSidebarToggle }: OrdersProps) {
  const { orders, isLoading } = useStaticOrders();
  const [filters, setFilters] = useState(DEFAULT_ORDER_FILTERS);

  const filteredOrders = useMemo(() => filterOrders(orders, filters), [orders, filters]);
  const filtersActive = hasActiveOrderFilters(filters);

  return (
    <div className="min-h-screen bg-muted/10">
      <Header sidebarOpen={sidebarOpen} onSidebarToggle={onSidebarToggle} />
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <MobileBackButton to="/" label="Back to Shop" />
        <h1 className="text-2xl font-display font-bold mb-4" data-testid="text-orders-title">Your Orders</h1>

        {!isLoading && orders.length > 0 && <OrderFilters value={filters} onChange={setFilters} />}

        {isLoading ? (
          <div className="text-center py-10">Loading...</div>
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
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
