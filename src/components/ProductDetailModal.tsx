import { useState, useMemo, useEffect } from 'react';
import type { Product } from '@/data/products';
import type { ProductVariant, SubscriptionFrequency } from '@/data/product_variants';
import { getVariantsForProduct, getSubscriptionConfig, isSubscriptionEnabled, getFrequencyLabel, calculateDeliveryCount } from '@/data/product_variants';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Minus, Plus, Calendar, Repeat, ShoppingBag, Sparkles, Package } from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (params: {
    productId: string;
    variantId: string;
    quantity: number;
    deliveryType: 'one_time' | 'subscription';
    subscriptionDuration?: number;
    subscriptionFrequency?: SubscriptionFrequency;
  }) => void;
}

export function ProductDetailModal({ product, open, onOpenChange, onAddToCart }: ProductDetailModalProps) {
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [deliveryType, setDeliveryType] = useState<'one_time' | 'subscription'>('one_time');
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedFrequency, setSelectedFrequency] = useState<SubscriptionFrequency>('daily');

  const variants = useMemo(() => (product ? getVariantsForProduct(product.id) : []), [product]);
  const subscriptionConfig = useMemo(() => (product ? getSubscriptionConfig(product.id) : null), [product]);
  const hasSubscription = useMemo(() => (product ? isSubscriptionEnabled(product.id) : false), [product]);
  const selectedVariant = useMemo(() => variants.find((v) => v.id === selectedVariantId), [variants, selectedVariantId]);
  const selectedDurationOption = useMemo(
    () => (subscriptionConfig && selectedDuration ? subscriptionConfig.durations.find((d) => d.duration_days === selectedDuration) : null),
    [subscriptionConfig, selectedDuration],
  );
  const deliveryCount = useMemo(
    () => (selectedDuration ? calculateDeliveryCount(selectedDuration, selectedFrequency) : 0),
    [selectedDuration, selectedFrequency],
  );
  const totalPrice = useMemo(() => {
    if (!selectedVariant) return 0;
    if (deliveryType === 'one_time') return selectedVariant.price * quantity;
    const basePrice = selectedVariant.price * deliveryCount;
    const discount = selectedDurationOption?.discount_percent || 0;
    return basePrice * (1 - discount / 100);
  }, [selectedVariant, quantity, deliveryType, deliveryCount, selectedDurationOption]);

  useEffect(() => {
    if (open && product) {
      const productVariants = getVariantsForProduct(product.id);
      setSelectedVariantId(productVariants[0]?.id || '');
      setQuantity(1);
      const config = getSubscriptionConfig(product.id);
      const hasSub = isSubscriptionEnabled(product.id);
      setDeliveryType(hasSub ? 'subscription' : 'one_time');
      if (config) {
        const sorted = [...config.durations].sort((a, b) => b.duration_days - a.duration_days);
        setSelectedDuration(sorted[0]?.duration_days || null);
      } else {
        setSelectedDuration(null);
      }
      setSelectedFrequency('daily');
    }
  }, [open, product]);

  const handleAddToCart = () => {
    if (!product || !selectedVariantId) return;
    onAddToCart({
      productId: product.id,
      variantId: selectedVariantId,
      quantity: deliveryType === 'one_time' ? quantity : 1,
      deliveryType,
      subscriptionDuration: deliveryType === 'subscription' ? selectedDuration || undefined : undefined,
      subscriptionFrequency: deliveryType === 'subscription' ? selectedFrequency : undefined,
    });
    onOpenChange(false);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <div className="relative h-40 md:h-48 overflow-hidden bg-gradient-to-br from-muted to-muted/50">
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <Badge variant="secondary" className="bg-white/90 text-foreground capitalize mb-2">
              {product.category}
            </Badge>
            <DialogTitle className="text-xl md:text-2xl text-white drop-shadow-lg">{product.name}</DialogTitle>
          </div>
        </div>

        <div className="p-4 md:p-5 space-y-5">
          <p className="text-sm text-muted-foreground">{product.description}</p>

          {variants.length > 1 && (
            <div className="space-y-3">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Package size={14} className="text-primary" />
                Select Size
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`p-3 rounded-xl border text-center transition-all active:scale-95 ${
                      selectedVariantId === variant.id
                        ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                        : 'border-border bg-white hover:border-primary/40 hover:bg-muted/30'
                    }`}
                    data-testid={`variant-${variant.id}`}
                  >
                    <div className="font-bold text-sm">{variant.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">${variant.price.toFixed(2)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {variants.length === 1 && (
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-muted/50 to-muted/30 rounded-xl border border-border/50">
              <span className="text-sm font-medium">{variants[0].name}</span>
              <span className="font-bold text-lg text-primary">${variants[0].price.toFixed(2)}</span>
            </div>
          )}

          {hasSubscription && subscriptionConfig && (
            <div className="space-y-3">
              <Label className="text-sm font-bold">Delivery Type</Label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => setDeliveryType('one_time')}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left active:scale-[0.98] ${
                    deliveryType === 'one_time' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${deliveryType === 'one_time' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    <ShoppingBag size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">One-time Purchase</div>
                    <p className="text-xs text-muted-foreground">Buy now, deliver today</p>
                  </div>
                </button>

                <button
                  onClick={() => setDeliveryType('subscription')}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left active:scale-[0.98] relative overflow-hidden ${
                    deliveryType === 'subscription' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${deliveryType === 'subscription' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    <Repeat size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      Subscribe & Save
                      <Badge className="text-[9px] bg-emerald-600 text-white border-0 px-1.5">
                        Up to {Math.max(...subscriptionConfig.durations.map((d) => d.discount_percent))}% OFF
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Regular delivery, pay upfront</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {deliveryType === 'one_time' && (
            <div className="space-y-3">
              <Label className="text-sm font-bold">Quantity</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-muted/50 rounded-xl p-1 border border-border/50">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white shadow-sm hover:bg-muted transition-colors active:scale-95"
                    data-testid="button-decrease-qty"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="font-bold w-12 text-center text-lg" data-testid="text-quantity">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white shadow-sm hover:bg-muted transition-colors active:scale-95"
                    data-testid="button-increase-qty"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {deliveryType === 'subscription' && subscriptionConfig && (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <Calendar size={14} className="text-primary" />
                  Duration
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {[...subscriptionConfig.durations].sort((a, b) => b.duration_days - a.duration_days).map((duration) => (
                    <button
                      key={duration.duration_days}
                      onClick={() => setSelectedDuration(duration.duration_days)}
                      className={`p-3 rounded-xl border text-center transition-all relative active:scale-95 ${
                        selectedDuration === duration.duration_days
                          ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                          : 'border-border bg-white hover:border-primary/40'
                      }`}
                      data-testid={`duration-${duration.duration_days}`}
                    >
                      <div className="font-bold text-sm">{duration.label}</div>
                      {duration.discount_percent > 0 && (
                        <Badge className="mt-1 text-[10px] bg-emerald-600 text-white border-0">
                          Save {duration.discount_percent}%
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <Repeat size={14} className="text-primary" />
                  Frequency
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {subscriptionConfig.frequencies.map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setSelectedFrequency(freq)}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-center active:scale-95 ${
                        selectedFrequency === freq
                          ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                          : 'border-border bg-white hover:border-primary/40'
                      }`}
                      data-testid={`frequency-${freq}`}
                    >
                      {getFrequencyLabel(freq)}
                    </button>
                  ))}
                </div>
              </div>

              {selectedDuration && (
                <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 rounded-xl space-y-2 text-sm border border-primary/20">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total deliveries</span>
                    <span className="font-bold">{deliveryCount} times</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Per delivery</span>
                    <span className="font-medium">${selectedVariant?.price.toFixed(2) || '0.00'}</span>
                  </div>
                  {selectedDurationOption && selectedDurationOption.discount_percent > 0 && (
                    <div className="flex justify-between text-primary font-bold">
                      <span>Your discount</span>
                      <span>-{selectedDurationOption.discount_percent}%</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground font-medium">Total</span>
              <div className="text-right">
                <span className="text-3xl font-display font-bold text-primary">${totalPrice.toFixed(2)}</span>
                {deliveryType === 'subscription' && selectedDuration && (
                  <p className="text-xs text-muted-foreground">for {selectedDuration} days</p>
                )}
              </div>
            </div>

            <Button
              onClick={handleAddToCart}
              className="w-full h-14 text-base font-bold rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/30 transition-all active:scale-[0.98]"
              disabled={!selectedVariantId || (deliveryType === 'subscription' && !selectedDuration)}
              data-testid="button-add-to-cart-modal"
            >
              {deliveryType === 'subscription' ? (
                <><Sparkles size={18} className="mr-2" />Subscribe Now</>
              ) : (
                <><ShoppingBag size={18} className="mr-2" />Add to Cart</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
