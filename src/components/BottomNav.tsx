import { Link, useLocation } from 'wouter';
import { Home, ClipboardList, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BottomNavProps {
  visible?: boolean;
}

export function BottomNav({ visible = true }: BottomNavProps) {
  const [location] = useLocation();

  if (!visible) return null;

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/orders', label: 'Orders', icon: ClipboardList },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg md:hidden" data-testid="bottom-nav">
      <div className="flex items-center justify-around py-2 px-4 gap-2">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path}>
              <Button
                variant="ghost"
                className={`flex flex-col items-center gap-1 h-auto py-2 px-4 ${
                  isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground'
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-xs ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
              </Button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
