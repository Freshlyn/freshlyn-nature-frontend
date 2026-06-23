import { useStaticCart } from '@/hooks/use-static-cart';
import { useCreateStaticOrder } from '@/hooks/use-static-orders';
import { useStaticAuth } from '@/hooks/use-static-auth';
import { Header } from '@/components/Header';
import { MobileBackButton } from '@/components/MobileBackButton';
import { AddressModal } from '@/components/AddressModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Plus, Minus, Trash2, ArrowRight, Loader2, ShoppingBag, Repeat,
  Calendar, Sparkles, Package, MapPin, Clock, ChevronRight, Home, Briefcase, Tag,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';
import { getFrequencyLabel } from '@/data/product_variants';
import type { UserAddress } from '@/data/users';

interface CartProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

const TIME_SLOTS = [
  '6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM',
  '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM',
  '10:00 AM',
];

function getLabelIcon(label: string) {
  switch (label.toLowerCase()) {
    case 'home': return <Home size={14} />;
    case 'work': return <Briefcase size={14} />;
    default: return <Tag size={14} />;
  }
}

export default function Cart({ sidebarOpen, onSidebarToggle }: CartProps) {
  const { getCartWithProducts, updateQuantity, removeFromCart, clearCart, getCartTotal } = useStaticCart();
  const { user } = useStaticAuth();
  const { createOrder, isPending } = useCreateStaticOrder();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState('7:00 AM');

  const cartItems = getCartWithProducts();
  const total = getCartTotal();
  const deliveryFee = total > 50 ? 0 : 5.0;
  const grandTotal = total + deliveryFee;

  const hasSubscriptionItems = useMemo(() => cartItems.some((item) => item.delivery_type === 'subscription'), [cartItems]);

  const selectedAddress = useMemo((): UserAddress | undefined => {
    if (!user) return undefined;
    if (selectedAddressId) return user.addresses.find((a) => a.id === selectedAddressId);
    return user.addresses.find((a) => a.is_default) || user.addresses[0];
  }, [user, selectedAddressId]);

  const handleCheckout = async () => {
    if (!user) {
      toast({ title: 'Please login', description: 'You need to be logged in to place an order', variant: 'destructive' });
      setLocation('/login');
      return;
    }
    if (!selectedAddress) {
      toast({ title: 'Add an address', description: 'Please add a delivery address before checkout', variant: 'destructive' });
      setAddressModalOpen(true);
      return;
    }
    setIsCheckingOut(true);
    try {
      await createOrder({ addressId: selectedAddress?.id, deliveryTime: hasSubscriptionItems ? selectedTime : undefined });
      toast({ title: 'Order Placed!', description: 'Your groceries are on the way!' });
      setLocation('/orders');
    } catch {
      toast({ title: 'Error', description: 'Failed to place order. Try again.', variant: 'destructive' });
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/20 to-background">
      <Header sidebarOpen={sidebarOpen} onSidebarToggle={onSidebarToggle} />

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8 max-w-4xl">
        <MobileBackButton to="/" label="Continue Shopping" />
        <div className="flex items-center justify-between mb-5 md:mb-8 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold">Your Cart</h1>
            {cartItems.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">{cartItems.length} item{cartItems.length > 1 ? 's' : ''} in your cart</p>
            )}
          </div>
          {cartItems.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
              onClick={() => clearCart()}
              data-testid="button-clear-cart"
            >
              <Trash2 size={14} className="mr-1.5" />
              Clear
            </Button>
          )}
        </div>

        {cartItems.length === 0 ? (
          <div className="text-center py-16 md:py-20 bg-white rounded-3xl border border-border/50 shadow-sm">
            <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBag size={40} className="text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground" data-testid="text-empty-cart">Your cart is empty</h2>
            <p className="text-muted-foreground mt-2 mb-8 max-w-xs mx-auto">Looks like you haven't added anything yet. Start shopping!</p>
            <Link href="/">
              <Button size="lg" className="rounded-xl px-8 font-bold bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/20" data-testid="button-start-shopping">
                <Sparkles size={18} className="mr-2" />
                Start Shopping
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            <div className="md:col-span-2 space-y-3">
              {cartItems.map((item) => (
                <div key={item.id} className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-border/40 hover:shadow-md transition-shadow" data-testid={`cart-item-${item.id}`}>
                  <div className="flex gap-3 md:gap-4">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 overflow-hidden flex-shrink-0 border border-border/30">
                      <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm md:text-base leading-tight truncate">{item.product.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Package size={10} />
                            {item.variant.name}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex-shrink-0"
                          data-testid={`button-remove-${item.id}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {item.delivery_type === 'subscription' && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge className="text-[10px] bg-gradient-to-r from-primary/20 to-accent/20 text-primary border-0 gap-1">
                            <Repeat size={10} />
                            Subscription
                          </Badge>
                          <Badge variant="outline" className="text-[10px] gap-1 border-border/60">
                            <Calendar size={10} />
                            {item.subscription_duration} days
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-border/60">
                            {item.subscription_frequency && getFrequencyLabel(item.subscription_frequency)}
                          </Badge>
                          {item.discount_percent && item.discount_percent > 0 && (
                            <Badge className="text-[10px] bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
                              {item.discount_percent}% OFF
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="flex items-end justify-between mt-3">
                        <div>
                          <p className="font-display font-bold text-lg text-primary">${item.item_total.toFixed(2)}</p>
                          {item.delivery_type === 'subscription' && item.delivery_count && (
                            <p className="text-[10px] text-muted-foreground">{item.delivery_count} deliveries</p>
                          )}
                        </div>

                        {item.delivery_type === 'one_time' && (
                          <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/40">
                            <button
                              onClick={() => item.quantity <= 1 ? removeFromCart(item.id) : updateQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-md bg-white shadow-sm text-foreground hover:bg-muted transition-colors active:scale-95"
                              data-testid={`button-decrease-${item.id}`}
                            >
                              {item.quantity <= 1 ? <Trash2 size={12} className="text-destructive" /> : <Minus size={12} />}
                            </button>
                            <span className="font-bold w-8 text-center text-sm" data-testid={`text-quantity-${item.id}`}>{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-md bg-white shadow-sm text-foreground hover:bg-muted transition-colors active:scale-95"
                              data-testid={`button-increase-${item.id}`}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        )}

                        {item.delivery_type === 'subscription' && (
                          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                            1 × {item.variant.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="md:col-span-1 space-y-4">
              {user && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-border/40">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <MapPin size={16} className="text-primary" />
                      Deliver To
                    </h3>
                    <Button variant="ghost" size="sm" className="text-primary text-xs gap-1" onClick={() => setAddressModalOpen(true)} data-testid="button-change-address">
                      Change
                      <ChevronRight size={14} />
                    </Button>
                  </div>

                  {selectedAddress ? (
                    <div className="flex items-start gap-2 cursor-pointer" onClick={() => setAddressModalOpen(true)} data-testid="text-selected-address">
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {getLabelIcon(selectedAddress.label)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs">{selectedAddress.label}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                          {[selectedAddress.flat_house, selectedAddress.building, selectedAddress.street, selectedAddress.city].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => setAddressModalOpen(true)} data-testid="button-add-address">
                      <Plus size={14} />
                      Add Delivery Address
                    </Button>
                  )}
                </div>
              )}

              {hasSubscriptionItems && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-border/40">
                  <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
                    <Clock size={16} className="text-primary" />
                    Delivery Time
                  </h3>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Your subscription items will be delivered daily at this time
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TIME_SLOTS.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                          selectedTime === time ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/50 text-foreground hover:bg-muted'
                        }`}
                        data-testid={`button-time-${time.replace(/[: ]/g, '-').toLowerCase()}`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2 bg-primary/5 rounded-lg p-2">
                    <Clock size={12} className="text-primary flex-shrink-0" />
                    <p className="text-[11px] text-muted-foreground">
                      Selected: <span className="font-semibold text-foreground">{selectedTime}</span> every day
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-white p-4 md:p-5 rounded-2xl shadow-lg border border-primary/10 sticky top-20">
                <h3 className="font-bold text-lg font-display flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <ShoppingBag size={16} className="text-primary" />
                  </div>
                  Order Summary
                </h3>

                <div className="space-y-3 mb-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Item Total</span>
                    <span className="font-medium" data-testid="text-subtotal">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span data-testid="text-delivery-fee">
                      {deliveryFee === 0 ? (
                        <Badge className="text-[10px] bg-green-100 text-green-700 border-0">FREE</Badge>
                      ) : (
                        <span className="font-medium">${deliveryFee.toFixed(2)}</span>
                      )}
                    </span>
                  </div>
                  {total < 50 && (
                    <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-3 rounded-xl text-xs">
                      <p className="text-foreground font-medium">
                        Add <span className="text-primary font-bold">${(50 - total).toFixed(2)}</span> more for free delivery!
                      </p>
                      <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all" style={{ width: `${Math.min((total / 50) * 100, 100)}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">Grand Total</span>
                    <span className="text-2xl font-display font-bold text-primary" data-testid="text-grand-total">${grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  onClick={handleCheckout}
                  disabled={isPending || isCheckingOut}
                  className="w-full h-14 text-base rounded-xl font-bold bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl transition-all active:scale-[0.98]"
                  data-testid="button-checkout"
                >
                  {isPending || isCheckingOut ? (
                    <><Loader2 className="animate-spin mr-2" /> Processing...</>
                  ) : (
                    <>Checkout <ArrowRight className="ml-2" size={18} /></>
                  )}
                </Button>

                <p className="text-[10px] text-center text-muted-foreground mt-4">
                  By placing an order, you agree to our Terms of Service
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <AddressModal
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        selectedAddressId={selectedAddress?.id}
        onSelectAddress={(addr) => {
          setSelectedAddressId(addr.id);
          setAddressModalOpen(false);
        }}
      />
    </div>
  );
}
