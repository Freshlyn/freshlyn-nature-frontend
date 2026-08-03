import type { OrderItemWithDetails } from "@/hooks/use-orders";
import { useOrder } from "@/hooks/use-orders";
import { Header } from "@/components/Header";
import { MobileBackButton } from "@/components/MobileBackButton";
import { format, addDays, isBefore, isToday, startOfDay } from "date-fns";
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
import { useState } from "react";
import type { SubscriptionFrequency } from "@/hooks/use-products";
import {
  getFrequencyLabel,
  getFrequencyIntervalDays,
} from "@/hooks/use-products";

const statusConfig: Record<
  string,
  { icon: typeof Clock; label: string; variant: string }
> = {
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

function generateDeliveryDates(
  startDate: Date,
  deliveryCount: number,
  frequency: SubscriptionFrequency,
): Date[] {
  const gap = getFrequencyIntervalDays(frequency);
  return Array.from({ length: deliveryCount }, (_, i) =>
    addDays(startDate, i * gap),
  );
}

function DeliverySchedule({
  item,
  orderDate,
  expanded,
  onToggle,
}: {
  item: OrderItemWithDetails;
  orderDate: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (
    item.delivery_type !== "subscription" ||
    !item.subscription_duration_days ||
    !item.subscription_frequency
  )
    return null;

  const startDate = startOfDay(new Date(orderDate));
  const deliveryDates = generateDeliveryDates(
    startDate,
    item.subscription_duration_days,
    item.subscription_frequency,
  );
  const today = startOfDay(new Date());
  const endDate = deliveryDates[deliveryDates.length - 1] ?? startDate;
  const missedSet = new Set<string>();

  // Pivot = index of today or first upcoming delivery
  const pivotIndex = deliveryDates.findIndex((date) => !isBefore(date, today));
  const effectivePivot = pivotIndex === -1 ? deliveryDates.length : pivotIndex;
  // Collapsed: show 2 past + 2 upcoming, clamped so we always get 4 rows
  const collapseStart = Math.max(
    0,
    Math.min(effectivePivot - 2, deliveryDates.length - 4),
  );
  const visibleDates = expanded
    ? deliveryDates
    : deliveryDates.slice(collapseStart, collapseStart + 4);
  const hasMore = deliveryDates.length > 4;

  return (
    <Card
      className="p-4 mt-3 bg-emerald-50/50 border-emerald-200/60"
      data-testid={`schedule-${item.id}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={16} className="text-emerald-600" />
        <h4 className="font-semibold text-sm text-emerald-800">
          Delivery Schedule
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <span className="text-muted-foreground block">Frequency</span>
          <span
            className="font-semibold text-foreground"
            data-testid={`text-frequency-${item.id}`}
          >
            {getFrequencyLabel(item.subscription_frequency!)}
          </span>
        </div>
        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <span className="text-muted-foreground block">Plan</span>
          <span
            className="font-semibold text-foreground"
            data-testid={`text-duration-${item.id}`}
          >
            {item.subscription_duration_days} Deliveries
          </span>
        </div>
        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <span className="text-muted-foreground block">Total Deliveries</span>
          <span
            className="font-semibold text-foreground"
            data-testid={`text-deliveries-${item.id}`}
          >
            {item.subscription_duration_days}
          </span>
        </div>
        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <span className="text-muted-foreground block">Ends on</span>
          <span
            className="font-semibold text-foreground"
            data-testid={`text-end-date-${item.id}`}
          >
            {format(endDate, "MMM d, yyyy")}
          </span>
        </div>
      </div>

      <div className="space-y-0">
        {visibleDates.map((date, sliceIndex) => {
          const globalIndex = expanded
            ? sliceIndex
            : collapseStart + sliceIndex;
          const isPast = isBefore(date, today) && !isToday(date);
          const isTodayDate = isToday(date);
          const isMissed = isPast && missedSet.has(format(date, "yyyy-MM-dd"));
          const isLast = sliceIndex === visibleDates.length - 1;

          return (
            <div
              key={globalIndex}
              className="flex items-center gap-3 relative"
              data-testid={`delivery-date-${globalIndex}`}
            >
              {!isLast && (
                <div
                  className={`absolute left-[9px] top-[22px] w-0.5 h-full ${isPast && !isMissed ? "bg-emerald-300" : "bg-gray-200"}`}
                />
              )}
              <div
                className={`w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                  isMissed
                    ? "bg-red-400"
                    : isPast
                      ? "bg-emerald-500"
                      : isTodayDate
                        ? "bg-emerald-500 ring-2 ring-emerald-200"
                        : "bg-gray-200"
                }`}
              >
                {isMissed ? (
                  <XCircle size={12} className="text-white" />
                ) : isPast || isTodayDate ? (
                  <CheckCircle size={12} className="text-white" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                )}
              </div>
              <div
                className={`flex-1 flex items-center justify-between gap-2 py-2.5 ${isTodayDate ? "font-semibold" : ""}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs ${isPast ? "text-muted-foreground" : "text-foreground"}`}
                    data-testid={`text-delivery-date-${globalIndex}`}
                  >
                    {format(date, "EEE, MMM d")}
                  </span>
                  {isTodayDate && (
                    <Badge
                      variant="default"
                      className="text-[10px] px-1.5 py-0 bg-emerald-600 h-4"
                      data-testid={`badge-today-${globalIndex}`}
                    >
                      Today
                    </Badge>
                  )}
                </div>
                <span
                  className={`text-xs ${isPast ? "text-muted-foreground" : "text-foreground"}`}
                  data-testid={`text-delivery-time-${globalIndex}`}
                >
                  9:00 AM
                </span>
              </div>
            </div>
          );
        })}
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
    </Card>
  );
}

function OneTimeItemCard({ item }: { item: OrderItemWithDetails }) {
  if (!item.product) return null;
  return (
    <div
      className="flex items-center gap-3 py-3"
      data-testid={`order-item-${item.id}`}
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        <img
          src={item.product.image_url ?? undefined}
          alt={item.product.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="font-medium text-sm truncate"
          data-testid={`text-item-name-${item.id}`}
        >
          {item.product.name}
        </p>
        <p
          className="text-xs text-muted-foreground"
          data-testid={`text-item-variant-${item.id}`}
        >
          {item.variant?.name} x {item.quantity}
        </p>
      </div>
      <span
        className="font-semibold text-sm whitespace-nowrap"
        data-testid={`text-item-price-${item.id}`}
      >
        ₹{(item.unit_price * item.quantity).toFixed(2)}
      </span>
    </div>
  );
}

function SubscriptionItemCard({
  item,
  orderDate,
  expandedId,
  onToggle,
}: {
  item: OrderItemWithDetails;
  orderDate: string;
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  if (!item.product) return null;
  const totalCost = item.subscription_duration_days
    ? item.unit_price *
      item.subscription_duration_days *
      (1 - (item.discount_percent || 0) / 100)
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
            <p
              className="font-medium text-sm"
              data-testid={`text-item-name-${item.id}`}
            >
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
        orderDate={orderDate}
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

export default function OrderDetail({
  sidebarOpen,
  onSidebarToggle,
}: OrderDetailProps) {
  const params = useParams<{ id: string }>();
  const { data: order, isLoading } = useOrder(params.id || "");
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(
    null,
  );

  const handleScheduleToggle = (id: string) => {
    setExpandedScheduleId((prev) => (prev === id ? null : id));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/10">
        <Header sidebarOpen={sidebarOpen} onSidebarToggle={onSidebarToggle} />
        <main
          className="container mx-auto px-4 py-6 max-w-2xl pb-24"
          data-testid="order-detail-skeleton"
        >
          <MobileBackButton to="/orders" label="Back to Orders" />

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
        <Header sidebarOpen={sidebarOpen} onSidebarToggle={onSidebarToggle} />
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <MobileBackButton to="/orders" label="Back to Orders" />
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
  const oneTimeItems = order.items.filter(
    (item) => item.delivery_type === "one_time",
  );
  const subscriptionItems = order.items.filter(
    (item) => item.delivery_type === "subscription",
  );

  const computedSubtotal = order.items.reduce((sum, item) => {
    if (
      item.delivery_type === "subscription" &&
      item.subscription_duration_days
    ) {
      return (
        sum +
        item.unit_price *
          item.subscription_duration_days *
          (1 - (item.discount_percent || 0) / 100)
      );
    }
    return sum + item.unit_price * item.quantity;
  }, 0);

  return (
    <div className="min-h-screen bg-muted/10">
      <Header sidebarOpen={sidebarOpen} onSidebarToggle={onSidebarToggle} />
      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        <MobileBackButton to="/orders" label="Back to Orders" />

        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div>
            <h1
              className="text-xl font-display font-bold"
              data-testid="text-order-detail-id"
            >
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
            <MapPin
              size={18}
              className="text-muted-foreground flex-shrink-0 mt-0.5"
            />
            <div>
              <h3 className="font-semibold text-sm mb-0.5">Delivery Address</h3>
              <p
                className="text-xs text-muted-foreground"
                data-testid="text-delivery-address"
              >
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
                  orderDate={order.created_at}
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
              <span data-testid="text-subtotal">
                ₹{computedSubtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span data-testid="text-delivery-fee">
                {order.delivery_fee > 0
                  ? `₹${order.delivery_fee.toFixed(2)}`
                  : "Free"}
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
