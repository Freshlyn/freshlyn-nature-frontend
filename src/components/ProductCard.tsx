import type { Product } from '@/hooks/use-products';
import { Button } from '@/components/ui/button';
import { Repeat, Plus } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  startingPrice: number;
  hasSubscription: boolean;
  quantity?: number;
  onAdd: () => void;
}

export function ProductCard({ product, startingPrice, hasSubscription, quantity = 0, onAdd }: ProductCardProps) {
  const imageSrc = product.image_url?.startsWith('http')
    ? product.image_url
    : `https://placehold.co/400x400/f3f4f6/a3a3a3?text=${encodeURIComponent(product.name)}`;

  return (
    <div
      className="group relative bg-white rounded-2xl overflow-hidden transition-all duration-300 flex flex-col h-full cursor-pointer shadow-sm hover:shadow-xl hover:shadow-primary/10 border border-border/40 hover:border-primary/30 active:scale-[0.98]"
      data-testid={`product-card-${product.id}`}
      onClick={onAdd}
    >
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted/30 to-muted/10">
        <img
          src={imageSrc}
          alt={product.name}
          className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide text-primary shadow-sm border border-primary/10">
          {product.category}
        </div>

        {hasSubscription && (
          <div className="absolute top-2 right-2 bg-gradient-to-r from-primary to-primary/80 text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-lg shadow-primary/30">
            <Repeat size={10} />
            Subscribe
          </div>
        )}

        {quantity > 0 && (
          <div className="absolute bottom-2 right-2 bg-primary text-white min-w-[28px] h-7 px-2 rounded-full flex items-center justify-center text-xs font-bold shadow-lg shadow-primary/40 ring-2 ring-white">
            {quantity}
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1">
        <div className="flex-1">
          <h3 className="font-bold text-sm text-foreground line-clamp-2 leading-snug min-h-[2.5rem] group-hover:text-primary transition-colors" title={product.name}>
            {product.name}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{product.description}</p>
        </div>

        <div className="mt-3 pt-3 border-t border-border/50 flex items-end justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground/70">From</span>
            <span className="font-display font-bold text-lg text-foreground leading-none">${startingPrice.toFixed(2)}</span>
          </div>

          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className={`h-9 px-3 rounded-xl font-bold text-xs transition-all shadow-md ${
              quantity > 0
                ? 'bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/30'
                : 'bg-primary text-white hover:bg-primary/90 shadow-primary/30'
            }`}
            data-testid={`button-add-${product.id}`}
          >
            {quantity > 0 ? <>Update</> : <><Plus size={14} className="mr-1" />Add</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
