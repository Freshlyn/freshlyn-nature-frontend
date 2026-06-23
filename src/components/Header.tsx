import { Link, useLocation } from 'wouter';
import { ShoppingBag, Search, MapPin, Menu, X } from 'lucide-react';
import { useStaticCart } from '@/hooks/use-static-cart';
import { useStaticAuth } from '@/hooks/use-static-auth';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onSearch?: (term: string) => void;
  location?: string;
  onLocationClick?: () => void;
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

export function Header({ onSearch, location = 'Select Location', onLocationClick, sidebarOpen, onSidebarToggle }: HeaderProps) {
  const [term, setTerm] = useState('');
  const { getCartCount, getCartTotal } = useStaticCart();
  const { user } = useStaticAuth();
  const [currentPath] = useLocation();
  const isHomePage = currentPath === '/';

  const itemCount = getCartCount();
  const cartTotal = getCartTotal();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(term);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-border/50 shadow-sm">
      <div className="container mx-auto px-3 md:px-4 py-2.5 md:py-3 flex items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          {user && onSidebarToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSidebarToggle}
              className="hidden md:flex rounded-full hover:bg-primary/10 hover:text-primary h-10 w-10"
              data-testid="button-hamburger"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          )}

          <Link href="/" className="flex items-center gap-1">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <ShoppingBag size={18} className="text-white md:hidden" />
              <ShoppingBag size={22} className="text-white hidden md:block" />
            </div>
            <span className="text-xl md:text-2xl font-display font-extrabold tracking-tight">
              <span className="text-primary">Freshlyn</span><span className="text-foreground">Nature</span>
            </span>
          </Link>

          <button
            onClick={onLocationClick}
            className="hidden md:flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-primary transition-colors bg-muted/50 hover:bg-primary/10 px-3 py-2 rounded-xl"
            data-testid="button-location"
          >
            <div className="p-1.5 bg-primary/10 rounded-full text-primary">
              <MapPin size={14} />
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Delivering to</span>
              <span className="truncate max-w-[120px] text-xs font-semibold">{location}</span>
            </div>
          </button>
        </div>

        {isHomePage && (
          <div className="flex-1 max-w-xl mx-2 md:mx-4 hidden sm:block">
            <form onSubmit={handleSearch} className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search for 'milk', 'bread', 'chips'..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-input bg-muted/30 focus:bg-white focus:border-primary/50 focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-muted-foreground/60 text-sm"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                data-testid="input-search"
              />
            </form>
          </div>
        )}

        <div className="flex items-center gap-2 md:gap-3">
          {!user && (
            <Link href="/login">
              <Button variant="default" size="sm" className="font-semibold" data-testid="button-login">
                Login
              </Button>
            </Link>
          )}

          <Link href="/cart">
            <Button
              className="relative h-10 md:h-11 px-3 md:px-4 rounded-xl font-bold tracking-wide transition-all duration-300 gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg shadow-primary/25"
              data-testid="button-cart"
            >
              <div className="relative">
                <ShoppingBag size={18} />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-4 h-4 bg-accent text-accent-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </div>
              {itemCount > 0 ? (
                <span className="text-sm font-bold">${cartTotal.toFixed(0)}</span>
              ) : (
                <span className="hidden md:inline text-sm">Cart</span>
              )}
            </Button>
          </Link>
        </div>
      </div>

      {isHomePage && (
        <div className="sm:hidden px-3 pb-3">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-muted/30 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              data-testid="input-search-mobile"
            />
          </form>
        </div>
      )}
    </header>
  );
}
