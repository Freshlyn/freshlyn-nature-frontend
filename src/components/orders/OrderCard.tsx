import type { OrderWithItems } from '@/hooks/use-static-orders';
import { format } from 'date-fns';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Link } from 'wouter';
import { displayStatusMeta, getDisplayStatus } from './orderCardStatus';

interface OrderCardProps {
  order: OrderWithItems;
}

export function OrderCardTracker({ order }: OrderCardProps) {
  const displayStatus = getDisplayStatus(order.status);
  const meta = displayStatusMeta[displayStatus];
  const StatusIcon = meta.icon;
  const thumbnails = order.items.slice(0, 3).filter((item) => item.product);
  const extraItemCount = Math.max(0, order.items.length - thumbnails.length);
  const hasSubscription = order.items.some((item) => item.delivery_type === 'subscription');

  return (
    <Link href={`/orders/${order.id}`}>
      <Card
        className="overflow-hidden cursor-pointer rounded-3xl p-0 border-border/40 shadow-[0_2px_4px_rgba(0,0,0,0.04),0_12px_28px_-8px_rgba(0,0,0,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.06),0_18px_36px_-8px_rgba(0,0,0,0.3)]"
        data-testid={`order-card-${order.id}`}
      >
        <div className={`px-4 py-2 flex items-center justify-between ${meta.badgeBg}`}>
          <div className={`flex items-center gap-2 text-sm font-bold ${meta.badgeText}`}>
            <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm">
              {displayStatus === 'active' && (
                <span className={`absolute inline-flex h-full w-full rounded-full ${meta.dot} opacity-20 animate-ping`} />
              )}
              <StatusIcon size={13} />
            </span>
            {meta.label}
          </div>
          {hasSubscription && (
            <Badge variant="outline" className="text-[11px] font-bold border-emerald-300 text-emerald-700 bg-white/80">
              <RefreshCw size={10} className="mr-1" />
              Subscription
            </Badge>
          )}
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="font-bold text-base text-foreground tracking-tight" data-testid={`text-order-id-${order.id}`}>
                Order #{order.id.replace('ord_', '')}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {order.item_count} {order.item_count === 1 ? 'item' : 'items'} · {format(new Date(order.created_at), 'MMM d, yyyy')}
              </p>
            </div>

            <div className="flex -space-x-2.5 flex-shrink-0">
              {thumbnails.map((item) => (
                <div
                  key={item.id}
                  className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white bg-muted flex-shrink-0 shadow-sm"
                >
                  <img src={item.product!.image_url} alt={item.product!.name} className="w-full h-full object-cover" />
                </div>
              ))}
              {extraItemCount > 0 && (
                <div className="w-10 h-10 rounded-xl border-2 border-white bg-muted flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-xs font-bold text-muted-foreground">+{extraItemCount}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Total</p>
              <span className="font-bold text-lg text-primary" data-testid={`text-order-total-${order.id}`}>
                ${order.total.toFixed(2)}
              </span>
            </div>
            <span className="flex items-center gap-1 text-sm font-bold text-foreground rounded-full pl-3 pr-2 py-1.5 bg-muted/70 group-hover:bg-muted">
              View order
              <ChevronRight size={16} className="text-muted-foreground" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
