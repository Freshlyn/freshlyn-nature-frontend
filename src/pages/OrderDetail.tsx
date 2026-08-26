import type { OrderItemWithDetails } from "@/hooks/use-orders";
import { useOrder } from "@/hooks/use-orders";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/Header";
import { format, isBefore, startOfDay } from "date-fns";
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  MapPin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useParams } from "wouter";
import { getFrequencyLabel } from "@/hooks/use-products";
import { describeOneTimeDelivery } from "@/lib/delivery-estimate";
import {
  DeliveryCardShell,
  DeliveryStat,
  DeliveryStatGrid,
  DeliveryTimelineRow,
} from "@/components/orders/DeliveryCard";

const statusConfig: Record<string, { icon: typeof Clock; label: string; variant: string }> = {
  pending: { icon: Clock, label: "Pending", variant: "secondary" },
  confirmed: { icon: CheckCircle, label: "Confirmed", variant: "default" },
  preparing: { icon: Package, label: "Preparing", variant: "default" },
  out_for_delivery: { icon: Truck, label: "On the way", variant: "default" },
  delivered: { icon: CheckCircle, label: "Delivered", variant: "default" },
  failed: {
    icon: AlertCircle,
    label: "Delivery failed",
    variant: "destructive",
  },
  cancelled: { icon: XCircle, label: "Cancelled", variant: "destructive" },
};

function DeliverySchedule({
  item,
  expanded,
  onToggle,
}: {
  item: OrderItemWithDetails;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (
    item.delivery_type !== "subscription" ||
    !item.subscription_duration_days ||
    !item.subscription_frequency
  )
    return null;

  // Read the schedule the backend actually stored. This used to be generated in
  // the browser from the order's created_at, which silently ignored the start
  // date the customer picked -- an order placed on the 20th for a subscription
  // starting the 25th rendered a schedule beginning on the 20th.
  const deliveries = [...(item.deliveries ?? [])].sort(
    (a, b) => a.sequence_number - b.sequence_number,
  );

  const today = startOfDay(new Date());

  // Orders placed before delivery rows were persisted have no schedule to show.
  // Showing nothing is deliberate: the dates were never recorded, and computing
  // stand-ins here is exactly the bug this replaced.
  if (deliveries.length === 0) {
    return (
      <Card className="p-4 mt-3 bg-muted/30 border-border/60" data-testid={`schedule-${item.id}`}>
        <div className="flex items-center gap-2 mb-1">
          <Calendar size={16} className="text-muted-foreground" />
          <h4 className="font-semibold text-sm text-foreground">Delivery Schedule</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          No delivery schedule was recorded for this order.
        </p>
      </Card>
    );
  }

  const deliveryDates = deliveries.map((d) => startOfDay(new Date(d.scheduled_date)));
  const startDate = deliveryDates[0];
  const endDate = deliveryDates[deliveryDates.length - 1] ?? startDate;

  // Pivot = index of today or first upcoming delivery
  const pivotIndex = deliveryDates.findIndex((date) => !isBefore(date, today));
  const effectivePivot = pivotIndex === -1 ? deliveryDates.length : pivotIndex;
  // Collapsed: show 2 past + 2 upcoming, clamped so we always get 4 rows
  const collapseStart = Math.max(0, Math.min(effectivePivot - 2, deliveryDates.length - 4));
  const visibleDeliveries = expanded
    ? deliveries
    : deliveries.slice(collapseStart, collapseStart + 4);
  const hasMore = deliveryDates.length > 4;

  return (
    <DeliveryCardShell title="Delivery Schedule" testId={`schedule-${item.id}`}>

      <DeliveryStatGrid>
        <DeliveryStat
          label="Frequency"
          value={getFrequencyLabel(item.subscription_frequency!)}
          testId={`text-frequency-${item.id}`}
        />
        <DeliveryStat
          label="Plan"
          value={`${item.subscription_duration_days} Deliveries`}
          testId={`text-duration-${item.id}`}
        />
        <DeliveryStat
          label="Total Deliveries"
          value={String(item.subscription_duration_days)}
          testId={`text-deliveries-${item.id}`}
        />
        <DeliveryStat
          label="Ends on"
          value={format(endDate, "MMM d, yyyy")}
          testId={`text-end-date-${item.id}`}
        />
      </DeliveryStatGrid>

      <div className="space-y-0">
        {visibleDeliveries.map((delivery, sliceIndex) => (
          <DeliveryTimelineRow
            key={delivery.id}
            delivery={delivery}
            showConnector={sliceIndex !== visibleDeliveries.length - 1}
            index={expanded ? sliceIndex : collapseStart + sliceIndex}
          />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={onToggle}
          className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-emerald-700 font-medium py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
          data-testid="button-toggle-schedule"
        >
          {expanded ? (
            <>
              Show less <ChevronUp size={14} />
            </>
          ) : (
            <>
              View full schedule <ChevronDown size={14} />
            </>
          )}
        </button>
      )}
    </DeliveryCardShell>
  );
}

function OneTimeDeliveryCard({ item }: { item: OrderItemWithDetails }) {
  // Nothing rendered when the backend recorded no delivery row. Orders placed
  // before the schedule was persisted genuinely have no date, and computing a
  // stand-in here is the bug the stored schedule replaced.
  const summary = describeOneTimeDelivery(item.deliveries);
  if (!summary) return null;

  // No timeline row here. With one delivery it would restate the tile's date
  // verbatim; the tile alone carries it, and the status badge covers what the
  // marker would have said.
  return (
    <DeliveryCardShell title="Delivery" testId={`schedule-${item.id}`}>
      <DeliveryStatGrid spaced={false}>
        <DeliveryStat
          label={summary.label}
          value={summary.value}
          wide
          badge={summary.badge}
          testId={`text-expected-delivery-${item.id}`}
        />
      </DeliveryStatGrid>
    </DeliveryCardShell>
  );
}

function OneTimeItemCard({ item }: { item: OrderItemWithDetails }) {
  if (!item.product) return null;
  return (
    <div data-testid={`order-item-${item.id}`}>
      <div className="flex items-center gap-3 py-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
          <img
            src={item.product.image_url ?? undefined}
            alt={item.product.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" data-testid={`text-item-name-${item.id}`}>
            {item.product.name}
          </p>
          <p className="text-xs text-muted-foreground" data-testid={`text-item-variant-${item.id}`}>
            {item.variant?.name} x {item.quantity}
          </p>
        </div>
        <span
          className="font-semibold text-sm whitespace-nowrap self-start pt-0.5"
          data-testid={`text-item-price-${item.id}`}
        >
          ₹{(item.unit_price * item.quantity).toFixed(2)}
        </span>
      </div>
      <OneTimeDeliveryCard item={item} />
    </div>
  );
}

function SubscriptionItemCard({
  item,
  expandedId,
  onToggle,
}: {
  item: OrderItemWithDetails;
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  if (!item.product) return null;
  const totalCost = item.subscription_duration_days
    ? item.unit_price * item.subscription_duration_days * (1 - (item.discount_percent || 0) / 100)
    : item.unit_price * item.quantity;

  return (
    <div data-testid={`order-item-${item.id}`}>
      <div className="flex items-center gap-3 py-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
          <img
            src={item.product.image_url ?? undefined}
            alt={item.product.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm" data-testid={`text-item-name-${item.id}`}>
              {item.product.name}
            </p>
            <Badge
              variant="outline"
              className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 h-4 px-1.5 py-0"
            >
              <RefreshCw size={8} className="mr-0.5" />
              Subscription
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {item.variant?.name} · {item.subscription_duration_days} deliveries
            {item.discount_percent ? ` · ${item.discount_percent}% off` : ""}
          </p>
        </div>
        <span
          className="font-semibold text-sm whitespace-nowrap"
          data-testid={`text-item-price-${item.id}`}
        >
          ₹{totalCost.toFixed(2)}
        </span>
      </div>
      <DeliverySchedule
        item={item}
        expanded={expandedId === item.id}
        onToggle={() => onToggle(item.id)}
      />
    </div>
  );
}

interface OrderDetailProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

export default function OrderDetail({ sidebarOpen, onSidebarToggle }: OrderDetailProps) {
  const params = useParams<{ id: string }>();
  const { data: order, isLoading } = useOrder(params.id || "");
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const orderId = params.id;

  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["order", orderId] });
        },
      )
      // A delivery's own status (scheduled -> delivered) never touches the
      // orders row, so the subscription above cannot see it. It is fetched as a
      // nested join by useOrder, and invalidating the order re-reads it.
      //
      // Unfiltered deliberately: subscription_deliveries has no order_id to
      // filter on, only order_item_id, so narrowing to this order would mean
      // denormalizing a column purely to shape a realtime filter. RLS already
      // limits events to this user's own deliveries, leaving at most a spare
      // invalidation of one cached query.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "subscription_deliveries" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["order", orderId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, queryClient]);

  const handleScheduleToggle = (id: string) => {
    setExpandedScheduleId((prev) => (prev === id ? null : id));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/10">
        <Header
          sidebarOpen={sidebarOpen}
          onSidebarToggle={onSidebarToggle}
          backTo="/orders"
          backLabel="Back to Orders"
        />
        <main
          className="container mx-auto px-4 py-6 max-w-2xl pb-24"
          data-testid="order-detail-skeleton"
        >
          {/* Title + status badge */}
          <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>

          {/* Delivery address card */}
          <Card className="p-4 mb-4">
            <Skeleton className="h-4 w-32 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </Card>

          {/* Items card */}
          <Card className="p-4 mb-4">
            <Skeleton className="h-4 w-24 mb-4" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-14 w-14 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          </Card>

          {/* Total card */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </Card>
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-muted/10">
        <Header
          sidebarOpen={sidebarOpen}
          onSidebarToggle={onSidebarToggle}
          backTo="/orders"
          backLabel="Back to Orders"
        />
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="text-center py-20">
            <Package size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold">Order not found</h2>
            <p className="text-muted-foreground mt-2 mb-6">
              This order doesn't exist or belongs to another account.
            </p>
            <Link href="/orders">
              <Button data-testid="button-back-orders">View All Orders</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const config = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const oneTimeItems = order.items.filter((item) => item.delivery_type === "one_time");
  const subscriptionItems = order.items.filter((item) => item.delivery_type === "subscription");

  const computedSubtotal = order.items.reduce((sum, item) => {
    if (item.delivery_type === "subscription" && item.subscription_duration_days) {
      return (
        sum +
        item.unit_price * item.subscription_duration_days * (1 - (item.discount_percent || 0) / 100)
      );
    }
    return sum + item.unit_price * item.quantity;
  }, 0);

  return (
    <div className="min-h-screen bg-muted/10">
      <Header
        sidebarOpen={sidebarOpen}
        onSidebarToggle={onSidebarToggle}
        backTo="/orders"
        backLabel="Back to Orders"
      />
      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div>
            <h1 className="text-xl font-display font-bold" data-testid="text-order-detail-id">
              Order #{order.id.replace("ord_", "")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(order.created_at), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          <Badge variant={config.variant as any} className="capitalize">
            <StatusIcon size={12} className="mr-1" />
            {config.label}
          </Badge>
        </div>

        <Card className="p-4 mb-4" data-testid="card-delivery-address">
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm mb-0.5">Delivery Address</h3>
              <p className="text-xs text-muted-foreground" data-testid="text-delivery-address">
                {order.delivery_address}
              </p>
            </div>
          </div>
        </Card>

        {oneTimeItems.length > 0 && (
          <Card className="p-4 mb-4" data-testid="card-onetime-items">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Package size={16} className="text-muted-foreground" />
              One-time Items ({oneTimeItems.length})
            </h3>
            <div className="divide-y divide-border">
              {oneTimeItems.map((item) => (
                <OneTimeItemCard key={item.id} item={item} />
              ))}
            </div>
          </Card>
        )}

        {subscriptionItems.length > 0 && (
          <Card className="p-4 mb-4" data-testid="card-subscription-items">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <RefreshCw size={16} className="text-emerald-600" />
              Subscription Items ({subscriptionItems.length})
            </h3>
            <div className="divide-y divide-border">
              {subscriptionItems.map((item) => (
                <SubscriptionItemCard
                  key={item.id}
                  item={item}
                  expandedId={expandedScheduleId}
                  onToggle={handleScheduleToggle}
                />
              ))}
            </div>
          </Card>
        )}

        <Card className="p-4" data-testid="card-order-summary">
          <h3 className="font-semibold text-sm mb-3">Order Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span data-testid="text-subtotal">₹{computedSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span data-testid="text-delivery-fee">
                {order.delivery_fee > 0 ? `₹${order.delivery_fee.toFixed(2)}` : "Free"}
              </span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
              <span>Total</span>
              <span data-testid="text-order-detail-total">
                ₹{(computedSubtotal + order.delivery_fee).toFixed(2)}
              </span>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
