import { Link, useLocation } from 'wouter';
import { Home, ClipboardList, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DesktopSidebarProps {
  isOpen: boolean;
}

export function DesktopSidebar({ isOpen }: DesktopSidebarProps) {
  const [location] = useLocation();

  if (!isOpen) return null;

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/orders', label: 'Orders', icon: ClipboardList },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <aside className="hidden md:block fixed left-0 top-[60px] bottom-0 w-56 bg-white border-r border-border shadow-lg z-40" data-testid="desktop-sidebar">
      <nav className="p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path}>
              <Button
                variant="ghost"
                className={`w-full justify-start gap-3 ${isActive ? 'text-primary bg-primary/10 font-semibold' : 'text-foreground'}`}
                data-testid={`sidebar-${item.label.toLowerCase()}`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-sm">{item.label}</span>
              </Button>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
