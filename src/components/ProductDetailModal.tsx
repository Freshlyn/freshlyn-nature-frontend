import { useState, useMemo, useEffect } from "react";
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
  calculateDeliveryCount,
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
import {
  Minus,
  Plus,
  Repeat,
  ShoppingBag,
  Sparkles,
  X,
  ImageOff,
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
  }) => void;
}

export function ProductDetailModal({
  product,
  open,
  onOpenChange,
  onAddToCart,
}: ProductDetailModalProps) {
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [deliveryType, setDeliveryType] = useState<"one_time" | "subscription">(
    "one_time",
  );
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedFrequency, setSelectedFrequency] =
    useState<SubscriptionFrequency>("daily");
  const [imageFailed, setImageFailed] = useState(false);
  const [isCloseClicked, setIsCloseClicked] = useState(false);
  const [displayedDeliveryType, setDisplayedDeliveryType] = useState<
    "one_time" | "subscription"
  >("one_time");

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
  const deliveryCount = useMemo(
    () =>
      selectedDuration
        ? calculateDeliveryCount(selectedDuration, selectedFrequency)
        : 0,
    [selectedDuration, selectedFrequency],
  );
  const totalPrice = useMemo(() => {
    if (!selectedVariant) return 0;
    if (deliveryType === "one_time") return selectedVariant.price * quantity;
    const basePrice = selectedVariant.price * deliveryCount;
    const discount = selectedDurationOption?.discount_percent || 0;
    return basePrice * (1 - discount / 100);
  }, [
    selectedVariant,
    quantity,
    deliveryType,
    deliveryCount,
    selectedDurationOption,
  ]);

  useEffect(() => {
    if (open && product) {
      const productVariants = getVariantsForProduct(product.id);
      setSelectedVariantId(productVariants[0]?.id || "");
      setQuantity(1);
      const config = getSubscriptionConfig(product.id);
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
      setImageFailed(false);
      setIsCloseClicked(false);
    }
  }, [open, product]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayedDeliveryType(deliveryType);
    }, 300);
    return () => clearTimeout(timer);
  }, [deliveryType]);

  const handleAddToCart = () => {
    if (!product || !selectedVariantId) return;
    onAddToCart({
      productId: product.id,
      variantId: selectedVariantId,
      quantity: deliveryType === "one_time" ? quantity : 1,
      deliveryType,
      subscriptionDuration:
        deliveryType === "subscription"
          ? selectedDuration || undefined
          : undefined,
      subscriptionFrequency:
        deliveryType === "subscription" ? selectedFrequency : undefined,
    });
    onOpenChange(false);
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

          {displayedDeliveryType === "one_time" && (
            <div className="flex items-center justify-between animate-in fade-in duration-200">
              <Label className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                Quantity
              </Label>
              <div className="flex items-center bg-muted/60 rounded-full p-0.5 border border-border/40 shadow-inner">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-sm hover:bg-muted transition-colors active:scale-95"
                  data-testid="button-decrease-qty"
                >
                  <Minus size={13} />
                </button>
                <span
                  className="font-bold w-8 text-center text-sm"
                  data-testid="text-quantity"
                >
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-sm hover:bg-muted transition-colors active:scale-95"
                  data-testid="button-increase-qty"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          )}

          {displayedDeliveryType === "subscription" && subscriptionConfig && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                  Duration
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
            </div>
          )}

          <div className="-mx-5 -mb-4 px-5 pt-4 pb-5 bg-gradient-to-b from-muted/30 to-muted/50 border-t border-border/40 flex items-center gap-4">
            <div className="flex-1">
              <span className="text-[10px] text-muted-foreground/80 font-medium uppercase tracking-wider block leading-tight">
                Total
              </span>
              <span className="text-2xl font-display font-bold text-primary leading-tight">
                ${totalPrice.toFixed(2)}
              </span>
            </div>

            <Button
              onClick={handleAddToCart}
              className="flex-1 h-11 text-sm font-bold rounded-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/35 transition-all duration-150 active:scale-[0.97] hover:shadow-xl hover:shadow-primary/40"
              disabled={
                !selectedVariantId ||
                (deliveryType === "subscription" && !selectedDuration)
              }
              data-testid="button-add-to-cart-modal"
            >
              {deliveryType === "subscription" ? (
                <>
                  <Sparkles size={15} className="mr-1.5" />
                  Subscribe
                </>
              ) : (
                <>
                  <ShoppingBag size={15} className="mr-1.5" />
                  Add to Cart
                </>
              )}
            </Button>
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
