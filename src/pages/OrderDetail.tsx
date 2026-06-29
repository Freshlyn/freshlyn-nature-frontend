import type { OrderItemWithDetails } from '@/hooks/use-static-orders';
import { useStaticOrders } from '@/hooks/use-static-orders';
import { Header } from '@/components/Header';
import { MobileBackButton } from '@/components/MobileBackButton';
import { format, addDays, isBefore, isToday, startOfDay } from 'date-fns';
import { Package, Clock, CheckCircle, Truck, XCircle, RefreshCw, Calendar, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link, useParams } from 'wouter';
import type { SubscriptionFrequency } from '@/data/product_variants';
import { getFrequencyLabel, getFrequencyIntervalDays } from '@/data/product_variants';

const statusConfig: Record<string, { icon: typeof Clock; label: string; variant: string }> = {
  pending: { icon: Clock, label: 'Pending', variant: 'secondary' },
  confirmed: { icon: CheckCircle, label: 'Confirmed', variant: 'default' },
  preparing: { icon: Package, label: 'Preparing', variant: 'default' },
  out_for_delivery: { icon: Truck, label: 'On the way', variant: 'default' },
  delivered: { icon: CheckCircle, label: 'Delivered', variant: 'default' },
  cancelled: { icon: XCircle, label: 'Cancelled', variant: 'destructive' },
};

function generateDeliveryDates(startDate: Date, deliveryCount: number, frequency: SubscriptionFrequency): Date[] {
  const gap = getFrequencyIntervalDays(frequency);
  return Array.from({ length: deliveryCount }, (_, i) => addDays(startDate, i * gap));
}

function DeliverySchedule({ item, orderDate }: { item: OrderItemWithDetails; orderDate: string }) {
  if (item.delivery_type !== 'subscription' || !item.subscription_duration || !item.subscription_frequency) return null;

  const startDate = startOfDay(new Date(orderDate));
  const deliveryDates = generateDeliveryDates(startDate, item.subscription_duration, item.subscription_frequency);
  const today = startOfDay(new Date());
  const endDate = deliveryDates[deliveryDates.length - 1] ?? startDate;

  return (
    <Card className="p-4 mt-3 bg-emerald-50/50 border-emerald-200/60" data-testid={`schedule-${item.id}`}>
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={16} className="text-emerald-600" />
        <h4 className="font-semibold text-sm text-emerald-800">Delivery Schedule</h4>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <span className="text-muted-foreground block">Frequency</span>
          <span className="font-semibold text-foreground" data-testid={`text-frequency-${item.id}`}>{getFrequencyLabel(item.subscription_frequency!)}</span>
        </div>
        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <span className="text-muted-foreground block">Plan</span>
          <span className="font-semibold text-foreground" data-testid={`text-duration-${item.id}`}>{item.subscription_duration} Deliveries</span>
        </div>
        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <span className="text-muted-foreground block">Total Deliveries</span>
          <span className="font-semibold text-foreground" data-testid={`text-deliveries-${item.id}`}>{item.delivery_count}</span>
        </div>
        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <span className="text-muted-foreground block">Ends on</span>
          <span className="font-semibold text-foreground" data-testid={`text-end-date-${item.id}`}>{format(endDate, 'MMM d, yyyy')}</span>
        </div>
      </div>

      <div className="space-y-0">
        {deliveryDates.map((date, index) => {
          const isPast = isBefore(date, today) && !isToday(date);
          const isTodayDate = isToday(date);

          return (
            <div key={index} className="flex items-center gap-3 relative" data-testid={`delivery-date-${index}`}>
              {index < deliveryDates.length - 1 && (
                <div className={`absolute left-[9px] top-[22px] w-0.5 h-full ${isPast ? 'bg-emerald-300' : 'bg-gray-200'}`} />
              )}
              <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                isPast ? 'bg-emerald-500' : isTodayDate ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-gray-200'
              }`}>
                {isPast || isTodayDate ? (
                  <CheckCircle size={12} className="text-white" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                )}
              </div>
              <div className={`flex-1 flex items-center justify-between gap-2 py-2.5 ${isTodayDate ? 'font-semibold' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs ${isPast ? 'text-muted-foreground' : 'text-foreground'}`} data-testid={`text-delivery-date-${index}`}>
                    {format(date, 'EEE, MMM d')}
                  </span>
                  {isTodayDate && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-emerald-600 h-4" data-testid={`badge-today-${index}`}>Today</Badge>
                  )}
                </div>
                <span className={`text-xs ${isPast ? 'text-muted-foreground' : 'text-foreground'}`} data-testid={`text-delivery-time-${index}`}>
                  9:00 AM
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function OneTimeItemCard({ item }: { item: OrderItemWithDetails }) {
  if (!item.product) return null;
  return (
    <div className="flex items-center gap-3 py-3" data-testid={`order-item-${item.id}`}>
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate" data-testid={`text-item-name-${item.id}`}>{item.product.name}</p>
        <p className="text-xs text-muted-foreground" data-testid={`text-item-variant-${item.id}`}>{item.variant?.name} x {item.quantity}</p>
      </div>
      <span className="font-semibold text-sm whitespace-nowrap" data-testid={`text-item-price-${item.id}`}>
        ${(item.unit_price * item.quantity).toFixed(2)}
      </span>
    </div>
  );
}

function SubscriptionItemCard({ item, orderDate }: { item: OrderItemWithDetails; orderDate: string }) {
  if (!item.product) return null;
  const totalCost = item.delivery_count
    ? item.unit_price * item.delivery_count * (1 - (item.discount_percent || 0) / 100)
    : item.unit_price * item.quantity;

  return (
    <div data-testid={`order-item-${item.id}`}>
      <div className="flex items-center gap-3 py-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
          <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm" data-testid={`text-item-name-${item.id}`}>{item.product.name}</p>
            <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 h-4 px-1.5 py-0">
              <RefreshCw size={8} className="mr-0.5" />
              Subscription
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {item.variant?.name} · {item.delivery_count} deliveries
            {item.discount_percent ? ` · ${item.discount_percent}% off` : ''}
          </p>
        </div>
        <span className="font-semibold text-sm whitespace-nowrap" data-testid={`text-item-price-${item.id}`}>
          ${totalCost.toFixed(2)}
        </span>
      </div>
      <DeliverySchedule item={item} orderDate={orderDate} />
    </div>
  );
}

interface OrderDetailProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

export default function OrderDetail({ sidebarOpen, onSidebarToggle }: OrderDetailProps) {
  const params = useParams<{ id: string }>();
  const { getOrderDetail } = useStaticOrders();
  const order = getOrderDetail(params.id || '');

  if (!order) {
    return (
      <div className="min-h-screen bg-muted/10">
        <Header sidebarOpen={sidebarOpen} onSidebarToggle={onSidebarToggle} />
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <MobileBackButton to="/orders" label="Back to Orders" />
          <div className="text-center py-20">
            <Package size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold">Order not found</h2>
            <p className="text-muted-foreground mt-2 mb-6">This order doesn't exist or belongs to another account.</p>
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
  const oneTimeItems = order.items.filter((item) => item.delivery_type === 'one_time');
  const subscriptionItems = order.items.filter((item) => item.delivery_type === 'subscription');

  const computedSubtotal = order.items.reduce((sum, item) => {
    if (item.delivery_type === 'subscription' && item.delivery_count) {
      return sum + item.unit_price * item.delivery_count * (1 - (item.discount_percent || 0) / 100);
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
            <h1 className="text-xl font-display font-bold" data-testid="text-order-detail-id">
              Order #{order.id.replace('ord_', '')}
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
              <p className="text-xs text-muted-foreground" data-testid="text-delivery-address">{order.delivery_address}</p>
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
              {oneTimeItems.map((item) => <OneTimeItemCard key={item.id} item={item} />)}
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
              {subscriptionItems.map((item) => <SubscriptionItemCard key={item.id} item={item} orderDate={order.created_at} />)}
            </div>
          </Card>
        )}

        <Card className="p-4" data-testid="card-order-summary">
          <h3 className="font-semibold text-sm mb-3">Order Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span data-testid="text-subtotal">${computedSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span data-testid="text-delivery-fee">{order.delivery_fee > 0 ? `$${order.delivery_fee.toFixed(2)}` : 'Free'}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
              <span>Total</span>
              <span data-testid="text-order-detail-total">${(computedSubtotal + order.delivery_fee).toFixed(2)}</span>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
