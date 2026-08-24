import { useQueryClient } from "@tanstack/react-query";
import { useStaticCart } from "@/hooks/use-static-cart";
import { useAuth } from "@/hooks/use-auth";
import { useAddresses } from "@/hooks/use-addresses";
import { useCheckout } from "@/hooks/use-checkout";
import { useRazorpay } from "@/hooks/use-razorpay";
import { useAddressServiceability } from "@/hooks/use-serviceability";
import { getErrorMessage, getRejectedItems } from "@/lib/errors";
import { OutOfStockStamp } from "@/components/OutOfStockStamp";
import { Header } from "@/components/Header";
import { AddressModal } from "@/components/AddressModal";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Loader2,
  ShoppingBag,
  Repeat,
  Calendar,
  Sparkles,
  Package,
  MapPin,
  Clock,
  ChevronRight,
  Home,
  Briefcase,
  Tag,
  Pencil,
  CreditCard,
  Wallet,
} from "lucide-react";
import type { Product } from "@/hooks/use-products";
import { getFrequencyLabel, useProducts, isVariantOutOfStock } from "@/hooks/use-products";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import type { UserAddress } from "@/types/user";
import {
  DEFAULT_DELIVERY_SLOT,
  EVENING_SLOTS,
  MORNING_SLOTS,
  formatDeliverySlot,
} from "@/lib/delivery-slots";

interface CartProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

// TODO: Move to BACKEND
const FREE_DELIVERY_THRESHOLD = 299;
const DELIVERY_FEE = 30;

const PAYMENT_METHODS = [
  {
    id: "razorpay" as const,
    title: "Pay Online",
    description: "UPI, cards, netbanking",
    icon: CreditCard,
  },
  {
    id: "cod" as const,
    title: "Cash on Delivery",
    description: "Pay the rider at your door",
    icon: Wallet,
  },
];

type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"];

function getLabelIcon(label: string) {
  switch (label.toLowerCase()) {
    case "home":
      return <Home size={14} />;
    case "work":
      return <Briefcase size={14} />;
    default:
      return <Tag size={14} />;
  }
}

export default function Cart({ sidebarOpen, onSidebarToggle }: CartProps) {
  const { data: allProducts = [], isLoading: productsLoading } = useProducts();
  const {
    cart,
    getCartWithProducts,
    isCartLoading,
    updateQuantity,
    removeFromCart,
    clearCart,
    addToCart,
  } = useStaticCart(allProducts, productsLoading);
  const { isAuthenticated, profile } = useAuth();
  const { data: addresses = [] } = useAddresses();
  const { mutateAsync: checkout, isPending } = useCheckout();
  const { openCheckout } = useRazorpay();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState(DEFAULT_DELIVERY_SLOT);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("razorpay");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  /**
   * Variant ids the SERVER refused on the last checkout attempt, keyed by
   * `${productId}:${variantId}`.
   *
   * Held separately from the cart itself because it is a fact about one
   * response, not about the stored cart: changing a quantity or removing the
   * line makes it obsolete, so it is cleared rather than persisted.
   */
  const [rejectedKeys, setRejectedKeys] = useState<Set<string>>(new Set());

  const cartItems = getCartWithProducts();
  // While details are still loading cartItems is empty, but the stored cart
  // already knows how many lines there are -- use it so the count does not
  // pop in after the skeleton clears.
  const displayCount = isCartLoading ? cart.length : cartItems.length;

  /**
   * Lines the customer cannot currently buy.
   *
   * Two sources, deliberately unioned. The variant's own stock is already in
   * memory (the cart-variants query selects it), so checking it costs nothing
   * and catches a cart resumed after the item sold out. The server rejections
   * catch the case no client check can -- stock that ran out while the customer
   * sat on this page -- and are authoritative when present.
   */
  const unavailableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of cartItems) {
      if (
        isVariantOutOfStock(item.variant) ||
        rejectedKeys.has(`${item.product_id}:${item.variant_id}`)
      ) {
        ids.add(item.id);
      }
    }
    return ids;
  }, [cartItems, rejectedKeys]);

  const hasUnavailable = unavailableIds.size > 0;

  // An unbuyable line must not inflate the total the customer is about to be
  // charged; checkout is blocked while any exists, so this is what they'd pay
  // after clearing them.
  const total = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => (unavailableIds.has(item.id) ? sum : sum + item.item_total),
        0,
      ),
    [cartItems, unavailableIds],
  );
  const deliveryFee = total > FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const grandTotal = total + deliveryFee;

  /** Drop every line the customer cannot buy, so checkout can proceed. */
  const removeUnavailable = () => {
    for (const id of unavailableIds) removeFromCart(id);
    setRejectedKeys(new Set());
  };

  /**
   * A server rejection describes one checkout attempt at one set of
   * quantities. Once the customer changes that line the verdict no longer
   * applies, so drop it and let the next attempt decide -- otherwise lowering
   * the quantity to a buyable amount would leave the line stuck as unavailable.
   *
   * The in-memory stock check is unaffected: it re-derives from the variant, so
   * a genuinely sold-out line stays marked through this.
   */
  const clearRejectionFor = (productId: string, variantId: string) => {
    const key = `${productId}:${variantId}`;
    setRejectedKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleUpdateQuantity = (item: (typeof cartItems)[number], quantity: number) => {
    clearRejectionFor(item.product_id, item.variant_id);
    updateQuantity(item.id, quantity);
  };

  const handleRemove = (item: (typeof cartItems)[number]) => {
    clearRejectionFor(item.product_id, item.variant_id);
    removeFromCart(item.id);
  };

  const hasSubscriptionItems = useMemo(
    () => cartItems.some((item) => item.delivery_type === "subscription"),
    [cartItems],
  );

  const selectedAddress = useMemo((): UserAddress | undefined => {
    if (selectedAddressId) return addresses.find((a) => a.id === selectedAddressId);
    return addresses.find((a) => a.is_default) || addresses[0];
  }, [addresses, selectedAddressId]);

  // Advisory only. The binding check runs inside create_order against these
  // same stored values, so this exists purely so the customer learns before
  // tapping rather than after. It can be stale if a zone changed mid-session,
  // in which case the server rejects and the toast tells them to re-check.
  const { data: serviceability, isLoading: serviceabilityLoading } =
    useAddressServiceability(selectedAddress);
  const addressNotServiceable = serviceability?.serviceable === false;

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Please login",
        description: "You need to be logged in to place an order",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }
    if (!selectedAddress) {
      toast({
        title: "Add an address",
        description: "Please add a delivery address before checkout",
        variant: "destructive",
      });
      setAddressModalOpen(true);
      return;
    }
    if (addressNotServiceable) {
      toast({
        title: "We don't deliver here yet",
        description: "FreshLyn covers parts of Kolkata. Choose another address to continue.",
        variant: "destructive",
      });
      setAddressModalOpen(true);
      return;
    }
    setIsCheckingOut(true);
    try {
      const order = await checkout({
        addressId: selectedAddress.id,
        cartItems,
        paymentMethod,
        deliverySlot: selectedTime,
      });

      if (paymentMethod === "cod") {
        toast({
          title: "Order Placed!",
          description: "Your groceries are on the way!",
        });
        clearCart();
        queryClient.resetQueries({ queryKey: ["orders"] });
        setLocation("/orders");
        return;
      }

      if (!order.razorpayOrderId || !order.razorpayKeyId) {
        throw new Error("Could not start payment. Please try again.");
      }

      const outcome = await openCheckout({
        razorpayOrderId: order.razorpayOrderId,
        razorpayKeyId: order.razorpayKeyId,
        customerPhone: profile?.phone ?? undefined,
      });

      if (outcome === "dismissed") {
        // Cart is deliberately NOT cleared: the customer can retry immediately.
        toast({
          title: "Payment cancelled",
          description: "Your cart is saved. You can try again whenever you like.",
        });
        return;
      }

      toast({
        title: "Order Placed!",
        description: "Your groceries are on the way!",
      });
      clearCart();
      // Reset (not invalidate) and done here rather than in useCheckout's
      // onSuccess: that fires when the Razorpay order is created, before payment.
      // reset discards the cached pages outright, so /orders mounts with
      // isLoading true and shows its skeleton; invalidate would leave the stale
      // data in place and render it settled for a frame.
      queryClient.resetQueries({ queryKey: ["orders"] });
      setLocation("/orders");
    } catch (err) {
      // Keep WHICH items the server refused, not just the prose. The toast can
      // only say "an item is out of stock"; these ids let the cart point at the
      // line so the customer can act on it.
      const rejected = await getRejectedItems(err);
      if (rejected.length > 0) {
        setRejectedKeys(new Set(rejected.map((r) => `${r.productId}:${r.variantId}`)));
      }
      toast({
        title: "Error",
        description: await getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/20 to-background">
      <Header
        sidebarOpen={sidebarOpen}
        onSidebarToggle={onSidebarToggle}
        backTo="/"
        backLabel="Continue Shopping"
      />

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-5 md:mb-8 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold">Your Cart</h1>
            {displayCount > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {displayCount} item{displayCount > 1 ? "s" : ""} in your cart
              </p>
            )}
          </div>
          {/* {cartItems.length > 0 && (
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
          )} */}
        </div>

        {isCartLoading ? (
          <div className="grid md:grid-cols-3 gap-4 md:gap-6" data-testid="cart-skeleton">
            <div className="md:col-span-2 space-y-3">
              {Array.from({ length: Math.min(cart.length, 3) }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-border/50 shadow-sm p-3 md:p-4"
                >
                  <div className="flex gap-3 md:gap-4">
                    <Skeleton className="w-20 h-20 md:w-24 md:h-24 rounded-xl flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-1/3" />
                      <div className="flex items-center justify-between pt-2">
                        <Skeleton className="h-9 w-28 rounded-lg" />
                        <Skeleton className="h-6 w-16" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="md:col-span-1">
              <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-4 space-y-4">
                <Skeleton className="h-6 w-32" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>
          </div>
        ) : cartItems.length === 0 ? (
          <div className="text-center py-16 md:py-20 bg-white rounded-3xl border border-border/50 shadow-sm">
            <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBag size={40} className="text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground" data-testid="text-empty-cart">
              Your cart is empty
            </h2>
            <p className="text-muted-foreground mt-2 mb-8 max-w-xs mx-auto">
              Looks like you haven't added anything yet. Start shopping!
            </p>
            <Link href="/">
              <Button
                size="lg"
                className="rounded-xl px-8 font-bold bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/20"
                data-testid="button-start-shopping"
              >
                <Sparkles size={18} className="mr-2" />
                Start Shopping
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            <div className="md:col-span-2 space-y-3">
              {cartItems.map((item) => {
                const itemUnavailable = unavailableIds.has(item.id);
                return (
                <div
                  key={item.id}
                  className={`bg-white p-3 md:p-4 rounded-2xl shadow-sm transition-shadow ${
                    itemUnavailable
                      ? "border-[1.5px] border-destructive/30 bg-destructive/[0.02]"
                      : "border border-border/40 hover:shadow-md"
                  }`}
                  data-testid={`cart-item-${item.id}`}
                  data-unavailable={itemUnavailable || undefined}
                >
                  <div className="flex gap-3 md:gap-4">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 overflow-hidden flex-shrink-0 border border-border/30">
                      <img
                        src={item.product.image_url ?? undefined}
                        alt={item.product.name}
                        className={`w-full h-full object-cover ${
                          itemUnavailable ? "grayscale opacity-45" : ""
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm md:text-base leading-tight truncate">
                            {item.product.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Package size={10} />
                            {item.variant.name}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemove(item)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex-shrink-0"
                          data-testid={`button-remove-${item.id}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {item.delivery_type === "subscription" && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge className="text-[10px] bg-gradient-to-r from-primary/20 to-accent/20 text-primary border-0 gap-1">
                            <Repeat size={10} />
                            Subscription
                          </Badge>
                          <Badge variant="outline" className="text-[10px] gap-1 border-border/60">
                            <Calendar size={10} />
                            {item.subscription_duration} deliveries
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-border/60">
                            {item.subscription_frequency &&
                              getFrequencyLabel(item.subscription_frequency)}
                          </Badge>
                          {item.discount_percent && item.discount_percent > 0 && (
                            <Badge className="text-[10px] bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
                              {item.discount_percent}% OFF
                            </Badge>
                          )}
                        </div>
                      )}

                      {itemUnavailable && (
                        <div className="mt-2 flex items-center gap-2">
                          <OutOfStockStamp data-testid={`cart-stamp-${item.id}`} />
                          <span className="text-[11px] text-muted-foreground leading-tight">
                            Remove this item to continue
                          </span>
                        </div>
                      )}

                      <div className="flex items-end justify-between mt-3">
                        <div>
                          <p
                            className={`font-display font-bold text-lg ${
                              itemUnavailable
                                ? "text-muted-foreground/50 line-through"
                                : "text-primary"
                            }`}
                          >
                            ₹{item.item_total.toFixed(2)}
                          </p>
                        </div>

                        {item.delivery_type === "one_time" && !itemUnavailable && (
                          <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/40">
                            <button
                              onClick={() =>
                                item.quantity <= 1
                                  ? handleRemove(item)
                                  : handleUpdateQuantity(item, item.quantity - 1)
                              }
                              className="w-8 h-8 flex items-center justify-center rounded-md bg-white shadow-sm text-foreground hover:bg-muted transition-colors active:scale-95"
                              data-testid={`button-decrease-${item.id}`}
                            >
                              {item.quantity <= 1 ? (
                                <Trash2 size={12} className="text-destructive" />
                              ) : (
                                <Minus size={12} />
                              )}
                            </button>
                            <span
                              className="font-bold w-8 text-center text-sm"
                              data-testid={`text-quantity-${item.id}`}
                            >
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateQuantity(item, item.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-md bg-white shadow-sm text-foreground hover:bg-muted transition-colors active:scale-95"
                              data-testid={`button-increase-${item.id}`}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        )}

                        {item.delivery_type === "subscription" && (
                          <button
                            onClick={() => {
                              setEditingProduct(item.product);
                              setEditModalOpen(true);
                            }}
                            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-primary/8"
                            data-testid={`button-edit-subscription-${item.id}`}
                          >
                            <Pencil size={11} />
                            Edit plan
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            <div className="md:col-span-1 space-y-4">
              {isAuthenticated && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-border/40">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <MapPin size={16} className="text-primary" />
                      Deliver To
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary text-xs gap-1"
                      onClick={() => setAddressModalOpen(true)}
                      data-testid="button-change-address"
                    >
                      Change
                      <ChevronRight size={14} />
                    </Button>
                  </div>

                  {selectedAddress ? (
                    <div
                      className="flex items-start gap-2 cursor-pointer"
                      onClick={() => setAddressModalOpen(true)}
                      data-testid="text-selected-address"
                    >
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {getLabelIcon(selectedAddress.label)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs">{selectedAddress.label}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                          {[
                            selectedAddress.flat_house,
                            selectedAddress.building,
                            selectedAddress.street,
                            selectedAddress.city,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-xs"
                      onClick={() => setAddressModalOpen(true)}
                      data-testid="button-add-address"
                    >
                      <Plus size={14} />
                      Add Delivery Address
                    </Button>
                  )}
                </div>
              )}

              {/* Shown for every cart, not just subscriptions: a one-time order
                  needs a delivery time too, and its slot drives the scheduled
                  instant stored against the order. */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-border/40">
                <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-primary" />
                  Delivery Time
                </h3>
                <p className="text-[11px] text-muted-foreground mb-3">
                  {hasSubscriptionItems
                    ? "Your subscription items will be delivered at this time"
                    : "Choose when you'd like your order delivered"}
                </p>

                {[
                  { title: "Morning", slots: MORNING_SLOTS },
                  { title: "Evening", slots: EVENING_SLOTS },
                ].map(({ title, slots }) => (
                  <div key={title} className="mb-3 last:mb-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      {title}
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {slots.map((slot) => (
                        <button
                          key={slot.value}
                          onClick={() => setSelectedTime(slot.value)}
                          className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                            selectedTime === slot.value
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted/50 text-foreground hover:bg-muted"
                          }`}
                          data-testid={`button-time-${slot.value.replace(":", "-")}`}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="mt-3 flex items-center gap-2 bg-primary/5 rounded-lg p-2">
                  <Clock size={12} className="text-primary flex-shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Selected:{" "}
                    <span className="font-semibold text-foreground">
                      {formatDeliverySlot(selectedTime)}
                    </span>
                    {hasSubscriptionItems ? " every delivery" : ""}
                  </p>
                </div>
              </div>

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
                    <span className="font-medium" data-testid="text-subtotal">
                      ₹{total.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span data-testid="text-delivery-fee">
                      {deliveryFee === 0 ? (
                        <Badge className="text-[10px] bg-green-100 text-green-700 border-0">
                          FREE
                        </Badge>
                      ) : (
                        <span className="font-medium">₹{deliveryFee.toFixed(2)}</span>
                      )}
                    </span>
                  </div>
                  {total < FREE_DELIVERY_THRESHOLD && (
                    <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-3 rounded-xl text-xs">
                      <p className="text-foreground font-medium">
                        Add{" "}
                        <span className="text-primary font-bold">
                          ₹{(FREE_DELIVERY_THRESHOLD - total).toFixed(2)}
                        </span>{" "}
                        more for free delivery!
                      </p>
                      <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all"
                          style={{
                            width: `${Math.min((total / FREE_DELIVERY_THRESHOLD) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">Grand Total</span>
                    <span
                      className="text-2xl font-display font-bold text-primary"
                      data-testid="text-grand-total"
                    >
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mb-3" role="group" aria-label="Payment method">
                  {PAYMENT_METHODS.map((method) => {
                    const isSelected = paymentMethod === method.id;
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        aria-pressed={isSelected}
                        disabled={isPending || isCheckingOut}
                        className={`flex items-center gap-3 w-full text-left p-3 rounded-xl border-[1.5px] transition-colors disabled:opacity-60 ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted"
                        }`}
                        data-testid={`button-payment-${method.id}`}
                      >
                        <span
                          className={`w-[18px] h-[18px] rounded-full border-2 grid place-items-center flex-shrink-0 ${
                            isSelected ? "border-primary" : "border-border"
                          }`}
                        >
                          <span
                            className={`w-[9px] h-[9px] rounded-full bg-primary transition-transform ${
                              isSelected ? "scale-100" : "scale-0"
                            }`}
                          />
                        </span>
                        <span className="flex flex-col gap-px">
                          <span
                            className={`text-sm font-semibold ${
                              isSelected ? "text-primary-deep" : "text-foreground"
                            }`}
                          >
                            {method.title}
                          </span>
                          <span className="text-[11.5px] text-muted-foreground">
                            {method.description}
                          </span>
                        </span>
                        <Icon
                          size={17}
                          className={`ml-auto ${
                            isSelected ? "text-primary-deep" : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {hasUnavailable && (
                  <div
                    className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
                    role="alert"
                    data-testid="banner-unavailable-items"
                  >
                    <p className="text-sm font-semibold text-destructive">
                      {unavailableIds.size === 1
                        ? "An item is no longer available"
                        : `${unavailableIds.size} items are no longer available`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {unavailableIds.size === 1 ? "It" : "They"} sold out while in your cart.
                      Remove {unavailableIds.size === 1 ? "it" : "them"} to place your order.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={removeUnavailable}
                      data-testid="button-remove-unavailable"
                    >
                      Remove unavailable {unavailableIds.size === 1 ? "item" : "items"}
                    </Button>
                  </div>
                )}

                {addressNotServiceable && (
                  <div
                    className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
                    role="alert"
                    data-testid="banner-address-not-serviceable"
                  >
                    <p className="text-sm font-semibold text-destructive">
                      We don't deliver to this address yet
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      FreshLyn covers parts of Kolkata and is expanding.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setAddressModalOpen(true)}
                      data-testid="button-choose-another-address"
                    >
                      Choose another address
                    </Button>
                  </div>
                )}

                <Button
                  onClick={handleCheckout}
                  disabled={
                    isPending ||
                    isCheckingOut ||
                    serviceabilityLoading ||
                    addressNotServiceable ||
                    hasUnavailable
                  }
                  className="w-full h-14 text-base rounded-xl font-bold bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl transition-all active:scale-[0.98]"
                  data-testid="button-checkout"
                >
                  {isPending || isCheckingOut ? (
                    <>
                      <Loader2 className="animate-spin mr-2" /> Processing...
                    </>
                  ) : paymentMethod === "razorpay" ? (
                    <>
                      Pay ₹{grandTotal.toFixed(2)} <ArrowRight className="ml-2" size={18} />
                    </>
                  ) : (
                    <>
                      Place Order · ₹{grandTotal.toFixed(2)}{" "}
                      <ArrowRight className="ml-2" size={18} />
                    </>
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
        mode="select"
        title="Delivery Address"
        selectedAddressId={selectedAddress?.id}
        onSelectAddress={(addr) => {
          setSelectedAddressId(addr.id);
          setAddressModalOpen(false);
        }}
        onAllAddressesDeleted={() => {
          // The id would otherwise still name the deleted row; selectedAddress
          // then resolves to undefined and handleCheckout's "Add an address"
          // guard takes over. The modal stays open so the user can add one.
          setSelectedAddressId(undefined);
        }}
      />

      <ProductDetailModal
        product={editingProduct}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        hideDeliveryToggle
        onAddToCart={(params) => addToCart(params)}
      />
    </div>
  );
}
