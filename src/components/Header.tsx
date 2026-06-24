import { Link, useLocation } from 'wouter';
import { ShoppingCart, Search, MapPin, Menu, X } from 'lucide-react';
import { useStaticCart } from '@/hooks/use-static-cart';
import { useStaticAuth } from '@/hooks/use-static-auth';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const { getCartCount } = useStaticCart();
  const { user } = useStaticAuth();
  const [currentPath] = useLocation();
  const isHomePage = currentPath === '/';

  const itemCount = getCartCount();
  const [displayCount, setDisplayCount] = useState(itemCount);
  const [justAdded, setJustAdded] = useState(false);
  const [dropId, setDropId] = useState(0);
  const prevCountRef = useRef(itemCount);

  useEffect(() => {
    if (itemCount > prevCountRef.current) {
      setJustAdded(true);
      setDropId((id) => id + 1);
      // Number bumps only once the falling item "lands" in the cart, not the instant it's added.
      const landTimeout = setTimeout(() => setDisplayCount(itemCount), 380);
      const endTimeout = setTimeout(() => setJustAdded(false), 650);
      prevCountRef.current = itemCount;
      return () => {
        clearTimeout(landTimeout);
        clearTimeout(endTimeout);
      };
    }
    setDisplayCount(itemCount);
    prevCountRef.current = itemCount;
  }, [itemCount]);

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

          <Link href="/" className="flex items-center">
            <img src="/logo.png" alt="Freshlyn Nature" className="h-11 md:h-14 w-auto object-contain" />
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
              <div className="relative flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/20 overflow-visible">
                {/* item falling in from above, landing inside the cart */}
                <AnimatePresence>
                  {justAdded && (
                    <motion.span
                      key={dropId}
                      className="absolute left-1/2 top-0 -translate-x-1/2 w-2.5 h-2.5 rounded-[3px] bg-accent shadow-md z-10"
                      initial={{ y: -22, opacity: 0, scale: 0.6, rotate: -20 }}
                      animate={{ y: [-22, -20, 2, 0], opacity: [0, 1, 1, 0], scale: [0.6, 1, 0.7, 0.3], rotate: [-20, 8, 0, 0] }}
                      transition={{ duration: 0.55, times: [0, 0.25, 0.75, 1], ease: 'easeIn' }}
                    />
                  )}
                </AnimatePresence>

                {/* impact flash right as the item lands */}
                <AnimatePresence>
                  {justAdded && (
                    <motion.span
                      key={`ring-${dropId}`}
                      className="absolute inset-0 rounded-full bg-accent"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: [0.6, 0.6, 1.7], opacity: [0, 0.7, 0] }}
                      transition={{ duration: 0.5, times: [0, 0.55, 1], ease: 'easeOut' }}
                    />
                  )}
                </AnimatePresence>

                {/* cart "catches" the item with a quick squash-and-settle */}
                <motion.div
                  animate={
                    justAdded
                      ? { scaleY: [1, 1, 0.75, 1.08, 1], scaleX: [1, 1, 1.1, 0.96, 1] }
                      : { scaleY: 1, scaleX: 1 }
                  }
                  transition={{ duration: 0.55, times: [0, 0.55, 0.7, 0.85, 1], ease: 'easeInOut' }}
                >
                  <ShoppingCart size={16} />
                </motion.div>
              </div>

              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={displayCount > 0 ? `count-${displayCount}` : 'label'}
                  initial={{ y: -10, opacity: 0, scale: 0.6 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 10, opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`text-sm font-bold whitespace-nowrap ${displayCount > 0 ? 'inline-block' : 'hidden md:inline-block'}`}
                  data-testid="text-cart-count"
                >
                  {displayCount > 0 ? `${displayCount} ${displayCount === 1 ? 'item' : 'items'}` : 'Cart'}
                </motion.span>
              </AnimatePresence>
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
