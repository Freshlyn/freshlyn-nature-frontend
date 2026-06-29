import { useState, useMemo, useEffect } from "react";
import {
  format,
  addDays,
  addMonths,
  subMonths,
  startOfDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isBefore,
  isAfter,
  isSameDay,
  getDay,
  differenceInCalendarDays,
} from "date-fns";
import type { Product } from "@/data/products";
import type {
  ProductVariant,
  SubscriptionFrequency,
} from "@/data/product_variants";
import {
  getVariantsForProduct,
  getSubscriptionConfig,
  isSubscriptionEnabled,
  getFrequencyLabel,
  getFrequencyIntervalDays,
} from "@/data/product_variants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useStaticCart } from "@/hooks/use-static-cart";
import { useToast } from "@/hooks/use-toast";
import {
  Minus,
  Plus,
  Repeat,
  ShoppingBag,
  Sparkles,
  X,
  ImageOff,
  Trash2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (params: {
    productId: string;
    variantId: string;
    quantity: number;
    deliveryType: "one_time" | "subscription";
    subscriptionDuration?: number;
    subscriptionFrequency?: SubscriptionFrequency;
    subscriptionStartDate?: string;
  }) => void;
}

export function ProductDetailModal({
  product,
  open,
  onOpenChange,
  onAddToCart,
}: ProductDetailModalProps) {
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [deliveryType, setDeliveryType] = useState<"one_time" | "subscription">(
    "one_time",
  );
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedFrequency, setSelectedFrequency] =
    useState<SubscriptionFrequency>("daily");
  const minStartDate = startOfDay(addDays(new Date(), 1));
  const maxStartDate = addMonths(minStartDate, 3);
  const [selectedStartDate, setSelectedStartDate] =
    useState<Date>(minStartDate);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarViewMonth, setCalendarViewMonth] = useState(
    startOfMonth(minStartDate),
  );
  const [imageFailed, setImageFailed] = useState(false);
  const [isCloseClicked, setIsCloseClicked] = useState(false);
  const [displayedDeliveryType, setDisplayedDeliveryType] = useState<
    "one_time" | "subscription"
  >("one_time");
  const [showUnsubscribeConfirm, setShowUnsubscribeConfirm] = useState(false);
  const [incrementPulse, setIncrementPulse] = useState(0);

  const {
    cart,
    addToCart,
    updateSubscriptionItem,
    removeFromCart,
    updateQuantity,
  } = useStaticCart();
  const { toast } = useToast();

  const existingSubscriptionItem = useMemo(
    () =>
      product
        ? cart.find(
            (item) =>
              item.product_id === product.id &&
              item.delivery_type === "subscription",
          )
        : undefined,
    [cart, product],
  );

  const oneTimeCartItem = useMemo(
    () =>
      product && selectedVariantId
        ? cart.find(
            (item) =>
              item.product_id === product.id &&
              item.delivery_type === "one_time" &&
              item.variant_id === selectedVariantId,
          )
        : undefined,
    [cart, product, selectedVariantId],
  );

  const handleCloseClick = () => {
    setIsCloseClicked(true);
    setTimeout(() => onOpenChange(false), 200);
  };

  const variants = useMemo(
    () => (product ? getVariantsForProduct(product.id) : []),
    [product],
  );
  const subscriptionConfig = useMemo(
    () => (product ? getSubscriptionConfig(product.id) : null),
    [product],
  );
  const hasSubscription = useMemo(
    () => (product ? isSubscriptionEnabled(product.id) : false),
    [product],
  );
  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId),
    [variants, selectedVariantId],
  );
  const selectedDurationOption = useMemo(
    () =>
      subscriptionConfig && selectedDuration
        ? subscriptionConfig.durations.find(
            (d) => d.duration_days === selectedDuration,
          )
        : null,
    [subscriptionConfig, selectedDuration],
  );
  // Duration now means "number of deliveries", so it's the count directly —
  // it no longer needs to be derived from frequency.
  const deliveryCount = selectedDuration ?? 0;
  const isCalendarDeliveryDay = (day: Date) => {
    const interval = getFrequencyIntervalDays(selectedFrequency);
    if (isBefore(day, selectedStartDate) && !isSameDay(day, selectedStartDate))
      return false;
    if (selectedDuration) {
      const lastDeliveryDate = addDays(
        selectedStartDate,
        (selectedDuration - 1) * interval,
      );
      if (isAfter(day, lastDeliveryDate)) return false;
    }
    return differenceInCalendarDays(day, selectedStartDate) % interval === 0;
  };
  const totalPrice = useMemo(() => {
    if (!selectedVariant || deliveryType !== "subscription") return 0;
    const basePrice = selectedVariant.price * deliveryCount;
    const discount = selectedDurationOption?.discount_percent || 0;
    return basePrice * (1 - discount / 100);
  }, [selectedVariant, deliveryType, deliveryCount, selectedDurationOption]);

  useEffect(() => {
    if (open && product) {
      const productVariants = getVariantsForProduct(product.id);
      const existingSub = cart.find(
        (item) =>
          item.product_id === product.id &&
          item.delivery_type === "subscription",
      );

      const existingOneTime = cart.find(
        (item) =>
          item.product_id === product.id &&
          item.delivery_type === "one_time",
      );
      const config = getSubscriptionConfig(product.id);

      const nextMinStartDate = startOfDay(addDays(new Date(), 1));

      if (existingSub) {
        setSelectedVariantId(existingSub.variant_id);
        setDeliveryType("subscription");
        setDisplayedDeliveryType("subscription");
        setSelectedDuration(existingSub.subscription_duration || null);
        setSelectedFrequency(existingSub.subscription_frequency || "daily");
        const existingStartDate = existingSub.subscription_start_date
          ? startOfDay(new Date(existingSub.subscription_start_date))
          : nextMinStartDate;
        setSelectedStartDate(existingStartDate);
        setCalendarViewMonth(startOfMonth(existingStartDate));
      } else if (existingOneTime) {
        setSelectedVariantId(existingOneTime.variant_id);
        setDeliveryType("one_time");
        setDisplayedDeliveryType("one_time");
        if (config) {
          const sorted = [...config.durations].sort(
            (a, b) => b.duration_days - a.duration_days,
          );
          setSelectedDuration(sorted[0]?.duration_days || null);
        } else {
          setSelectedDuration(null);
        }
        setSelectedFrequency("daily");
        setSelectedStartDate(nextMinStartDate);
        setCalendarViewMonth(startOfMonth(nextMinStartDate));
      } else {
        setSelectedVariantId(productVariants[0]?.id || "");
        const hasSub = isSubscriptionEnabled(product.id);
        const initialDeliveryType = hasSub ? "subscription" : "one_time";
        setDeliveryType(initialDeliveryType);
        setDisplayedDeliveryType(initialDeliveryType);
        if (config) {
          const sorted = [...config.durations].sort(
            (a, b) => b.duration_days - a.duration_days,
          );
          setSelectedDuration(sorted[0]?.duration_days || null);
        } else {
          setSelectedDuration(null);
        }
        setSelectedFrequency("daily");
        setSelectedStartDate(nextMinStartDate);
        setCalendarViewMonth(startOfMonth(nextMinStartDate));
      }
      setImageFailed(false);
      setIsCloseClicked(false);
      setShowUnsubscribeConfirm(false);
      setShowCalendar(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayedDeliveryType(deliveryType);
    }, 300);
    return () => clearTimeout(timer);
  }, [deliveryType]);

  const handleSubscribe = () => {
    if (!product || !selectedVariantId || !selectedDuration) return;

    const subscriptionStartDate = format(selectedStartDate, "yyyy-MM-dd");

    if (existingSubscriptionItem) {
      updateSubscriptionItem(existingSubscriptionItem.id, {
        variantId: selectedVariantId,
        subscriptionDuration: selectedDuration,
        subscriptionFrequency: selectedFrequency,
        subscriptionStartDate,
      });
      onOpenChange(false);
      return;
    }

    onAddToCart({
      productId: product.id,
      variantId: selectedVariantId,
      quantity: 1,
      deliveryType: "subscription",
      subscriptionDuration: selectedDuration,
      subscriptionFrequency: selectedFrequency,
      subscriptionStartDate,
    });
    onOpenChange(false);
  };

  const handleIncrementOneTime = () => {
    if (!product || !selectedVariantId) return;
    setIncrementPulse((p) => p + 1);
    if (oneTimeCartItem) {
      updateQuantity(oneTimeCartItem.id, oneTimeCartItem.quantity + 1);
    } else {
      addToCart({
        productId: product.id,
        variantId: selectedVariantId,
        quantity: 1,
        deliveryType: "one_time",
      });
    }
  };

  const handleDecrementOneTime = () => {
    if (!oneTimeCartItem) return;
    if (oneTimeCartItem.quantity <= 1) {
      removeFromCart(oneTimeCartItem.id);
    } else {
      updateQuantity(oneTimeCartItem.id, oneTimeCartItem.quantity - 1);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0 flex flex-col rounded-[28px] shadow-2xl border-0 [&>button]:hidden">
        <div className="relative h-36 overflow-hidden shrink-0 bg-gradient-to-br from-primary/40 via-primary/15 to-accent/30">
          {!imageFailed && (
            <img
              src={product.image_url}
              alt={product.name}
              onError={() => setImageFailed(true)}
              className="w-full h-full object-cover"
            />
          )}
          {imageFailed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageOff size={32} className="text-white/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/5" />
          <Badge
            variant="secondary"
            className="absolute top-3 left-4 bg-white/95 text-foreground backdrop-blur-sm capitalize shadow-sm text-[10px] font-semibold tracking-wide px-2.5 py-0.5"
          >
            {product.category}
          </Badge>
          <DialogTitle className="absolute bottom-4 left-5 right-5 text-2xl text-white drop-shadow-md font-display tracking-tight">
            {product.name}
          </DialogTitle>
        </div>

        <div className="relative z-10 -mt-5 rounded-t-[24px] bg-white px-5 pt-5 pb-4 space-y-4 shadow-[0_-12px_24px_-16px_rgba(0,0,0,0.12)]">
          <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
            {product.description}
          </p>

          {variants.length > 1 && (
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                Size
              </Label>
              <div className="flex flex-wrap gap-2">
                {variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`px-3 py-1.5 rounded-2xl border text-center leading-tight transition-all duration-150 active:scale-95 ${
                      selectedVariantId === variant.id
                        ? "border-primary bg-gradient-to-r from-primary to-primary/85 shadow-md shadow-primary/25 ring-1 ring-primary/30"
                        : "border-border/70 bg-white hover:border-primary/40 hover:shadow-sm"
                    }`}
                    data-testid={`variant-${variant.id}`}
                  >
                    <div
                      className={`text-xs font-bold ${
                        selectedVariantId === variant.id
                          ? "text-white"
                          : "text-foreground"
                      }`}
                    >
                      {variant.name}
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        selectedVariantId === variant.id
                          ? "text-white/80"
                          : "text-muted-foreground"
                      }`}
                    >
                      ${variant.price.toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {variants.length === 1 && (
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40 rounded-xl border border-border/40 text-sm">
              <span className="font-medium">{variants[0].name}</span>
              <span className="font-bold text-primary">
                ${variants[0].price.toFixed(2)}
              </span>
            </div>
          )}

          {hasSubscription && subscriptionConfig && (
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                Delivery
              </Label>
              <div className="relative flex bg-muted/60 rounded-full p-1 border border-border/40 shadow-inner">
                <div
                  className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-md transition-transform duration-300 ease-out"
                  style={{
                    transform:
                      deliveryType === "subscription"
                        ? "translateX(calc(100% + 8px))"
                        : "translateX(0)",
                  }}
                />
                <button
                  onClick={() => setDeliveryType("one_time")}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-semibold transition-colors duration-300 active:scale-95 ${
                    deliveryType === "one_time"
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ShoppingBag size={13} />
                  One-time
                </button>
                <button
                  onClick={() => setDeliveryType("subscription")}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-semibold transition-colors duration-300 active:scale-95 ${
                    deliveryType === "subscription"
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Repeat size={13} />
                  Subscribe
                  <Badge className="text-[8px] bg-emerald-600 text-white border-0 px-1.5 py-0 leading-tight font-semibold">
                    -
                    {Math.max(
                      ...subscriptionConfig.durations.map(
                        (d) => d.discount_percent,
                      ),
                    )}
                    %
                  </Badge>
                </button>
              </div>
            </div>
          )}

          {displayedDeliveryType === "subscription" && subscriptionConfig && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                  Plan
                </Label>
                <div className="flex flex-wrap gap-2">
                  {[...subscriptionConfig.durations]
                    .sort((a, b) => b.duration_days - a.duration_days)
                    .map((duration) => (
                      <button
                        key={duration.duration_days}
                        onClick={() =>
                          setSelectedDuration(duration.duration_days)
                        }
                        className={`px-3 py-1.5 rounded-2xl border text-center leading-tight transition-all duration-150 active:scale-95 ${
                          selectedDuration === duration.duration_days
                            ? "border-primary bg-gradient-to-r from-primary to-primary/85 shadow-md shadow-primary/25 ring-1 ring-primary/30"
                            : "border-border/70 bg-white hover:border-primary/40 hover:shadow-sm"
                        }`}
                        data-testid={`duration-${duration.duration_days}`}
                      >
                        <div
                          className={`text-xs font-bold ${
                            selectedDuration === duration.duration_days
                              ? "text-white"
                              : "text-foreground"
                          }`}
                        >
                          {duration.label}
                        </div>
                        {duration.discount_percent > 0 && (
                          <div
                            className={`text-[11px] mt-0.5 ${
                              selectedDuration === duration.duration_days
                                ? "text-white/80"
                                : "text-emerald-600"
                            }`}
                          >
                            -{duration.discount_percent}%
                          </div>
                        )}
                      </button>
                    ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                  Frequency
                </Label>
                <div className="flex flex-wrap gap-2">
                  {subscriptionConfig.frequencies.map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setSelectedFrequency(freq)}
                      className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all duration-150 active:scale-95 ${
                        selectedFrequency === freq
                          ? "border-primary bg-gradient-to-r from-primary to-primary/85 text-white shadow-md shadow-primary/25 ring-1 ring-primary/30"
                          : "border-border/70 bg-white text-foreground hover:border-primary/40 hover:shadow-sm"
                      }`}
                      data-testid={`frequency-${freq}`}
                    >
                      {getFrequencyLabel(freq)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                  Start Date
                </Label>
                <button
                  onClick={() => setShowCalendar((v) => !v)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-border/70 bg-white hover:border-primary/40 hover:shadow-sm transition-all duration-150"
                  data-testid="button-start-date"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CalendarDays size={15} className="text-primary" />
                    {isSameDay(selectedStartDate, minStartDate)
                      ? `Tomorrow, ${format(selectedStartDate, "d MMM")}`
                      : format(selectedStartDate, "EEE, d MMM yyyy")}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {showCalendar ? "Close" : "Change"}
                  </span>
                </button>

                {showCalendar && (
                  <div className="rounded-xl border border-border/70 bg-white p-3 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setCalendarViewMonth((m) => subMonths(m, 1))
                        }
                        disabled={
                          startOfMonth(calendarViewMonth).getTime() <=
                          startOfMonth(minStartDate).getTime()
                        }
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors disabled:opacity-30"
                        data-testid="button-prev-month"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-xs font-semibold">
                        {format(calendarViewMonth, "MMMM yyyy")}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCalendarViewMonth((m) => addMonths(m, 1))
                        }
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                        data-testid="button-next-month"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground/70 font-medium">
                      {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                        <span key={i}>{d}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                      Delivery day
                    </p>
                    <div className="grid grid-cols-7 gap-1">
                      {(() => {
                        const start = startOfMonth(calendarViewMonth);
                        const end = endOfMonth(calendarViewMonth);
                        const leadingBlanks = getDay(start);
                        const monthDays = eachDayOfInterval({ start, end });
                        const cells: (Date | null)[] = [
                          ...Array(leadingBlanks).fill(null),
                          ...monthDays,
                        ];
                        return cells.map((day, i) => {
                          if (!day) return <span key={i} />;
                          const outOfRange =
                            isBefore(day, minStartDate) ||
                            isBefore(maxStartDate, day);
                          return (
                            <button
                              key={i}
                              type="button"
                              disabled={outOfRange}
                              onClick={() => setSelectedStartDate(day)}
                              className={`relative h-9 w-9 text-[11px] rounded-full flex items-center justify-center transition-colors ${
                                isSameDay(day, selectedStartDate)
                                  ? "bg-primary text-white font-bold"
                                  : outOfRange
                                    ? "text-muted-foreground/30 cursor-not-allowed"
                                    : "hover:bg-primary/10 text-foreground"
                              }`}
                              data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                            >
                              {format(day, "d")}
                              {isCalendarDeliveryDay(day) && (
                                <span
                                  className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                                    isSameDay(day, selectedStartDate)
                                      ? "bg-white"
                                      : "bg-primary"
                                  }`}
                                />
                              )}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {selectedDuration && (
                <div className="flex items-center justify-between text-xs bg-gradient-to-r from-primary/8 to-accent/8 px-3.5 py-2.5 rounded-xl border border-primary/15">
                  <span className="text-muted-foreground">
                    {deliveryCount} deliveries · $
                    {selectedVariant?.price.toFixed(2) || "0.00"} each
                  </span>
                  {selectedDurationOption &&
                    selectedDurationOption.discount_percent > 0 && (
                      <span className="text-emerald-600 font-bold">
                        -{selectedDurationOption.discount_percent}%
                      </span>
                    )}
                </div>
              )}

              {existingSubscriptionItem && (
                <div className="pt-1">
                  {!showUnsubscribeConfirm ? (
                    <button
                      onClick={() => setShowUnsubscribeConfirm(true)}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 transition-colors py-1.5"
                      data-testid="button-unsubscribe"
                    >
                      <Trash2 size={13} />
                      Unsubscribe
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-3 text-xs bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                      <span className="text-red-600 font-medium">
                        Remove this subscription?
                      </span>
                      <button
                        onClick={() => {
                          removeFromCart(existingSubscriptionItem.id);
                          toast({ title: "Subscription removed" });
                          onOpenChange(false);
                        }}
                        className="font-bold text-red-600 hover:text-red-700"
                        data-testid="button-confirm-unsubscribe"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setShowUnsubscribeConfirm(false)}
                        className="font-semibold text-muted-foreground hover:text-foreground"
                        data-testid="button-cancel-unsubscribe"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="-mx-5 -mb-4 px-5 pt-4 pb-5 bg-gradient-to-b from-muted/30 to-muted/50 border-t border-border/40">
            {displayedDeliveryType === "one_time" ? (
              <div className="flex items-center justify-between gap-4 animate-in fade-in duration-200">
                <div className="leading-tight">
                  <span className="text-[10px] text-muted-foreground/80 font-medium uppercase tracking-wider block leading-tight">
                    Price
                  </span>
                  <span className="text-2xl font-display font-bold text-primary leading-tight">
                    ${selectedVariant ? selectedVariant.price.toFixed(2) : "0.00"}
                  </span>
                  <span className="text-[11px] text-muted-foreground"> / item</span>
                </div>

                <div className="relative w-[132px] h-11 flex items-center justify-end shrink-0">
                {incrementPulse > 0 && (
                  <span
                    key={incrementPulse}
                    className="absolute inset-0 rounded-full border-2 border-primary animate-ring-pulse pointer-events-none"
                  />
                )}
                {!oneTimeCartItem || oneTimeCartItem.quantity <= 0 ? (
                  <button
                    onClick={handleIncrementOneTime}
                    disabled={!selectedVariantId}
                    className="h-11 w-full flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white text-sm font-bold shadow-lg shadow-primary/35 transition-all duration-150 active:scale-[0.97] hover:shadow-xl hover:shadow-primary/40 disabled:opacity-50"
                    data-testid="button-add-to-cart-modal"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                    Add
                  </button>
                ) : (
                  <div
                    className="flex items-center justify-between w-full h-11 bg-white rounded-full p-1 border border-primary/30 shadow-md shadow-primary/10"
                    data-testid="stepper-one-time"
                  >
                    <button
                      onClick={handleDecrementOneTime}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors active:scale-95"
                      data-testid="button-decrease-qty"
                    >
                      <Minus size={15} />
                    </button>
                    <span
                      key={incrementPulse}
                      className="font-bold w-9 text-center text-base animate-qty-bump"
                      data-testid="text-quantity"
                    >
                      {oneTimeCartItem.quantity}
                    </span>
                    <button
                      onClick={handleIncrementOneTime}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-colors active:scale-95 shadow-sm shadow-primary/30"
                      data-testid="button-increase-qty"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 animate-in fade-in duration-200">
                <div className="flex-1 leading-tight">
                  <span className="text-[10px] text-muted-foreground/80 font-medium uppercase tracking-wider block leading-tight">
                    Total
                  </span>
                  <span className="text-2xl font-display font-bold text-primary leading-tight">
                    ${totalPrice.toFixed(2)}
                  </span>
                </div>

                <Button
                  onClick={handleSubscribe}
                  className="flex-1 h-11 text-sm font-bold rounded-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/35 transition-all duration-150 active:scale-[0.97] hover:shadow-xl hover:shadow-primary/40"
                  disabled={!selectedVariantId || !selectedDuration}
                  data-testid="button-add-to-cart-modal"
                >
                  <Sparkles size={15} className="mr-1.5" />
                  {existingSubscriptionItem
                    ? "Update Subscription"
                    : "Subscribe"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
      {open && (
        <button
          onClick={handleCloseClick}
          aria-label="Close"
          className={`fixed bottom-[2vh] left-1/2 -translate-x-1/2 z-[60] w-11 h-11 rounded-full flex items-center justify-center text-white transition-all duration-200 active:scale-90 backdrop-blur-xl ${
            isCloseClicked ? "animate-close-click" : ""
          }`}
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0.1))",
            boxShadow:
              "0 8px 18px -4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.35)",
          }}
          data-testid="button-close-modal"
        >
          <X size={18} strokeWidth={2.25} />
        </button>
      )}
    </Dialog>
  );
}
