import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

interface MobileBackButtonProps {
  to: string;
  label?: string;
}

export function MobileBackButton({ to, label = 'Back' }: MobileBackButtonProps) {
  return (
    <div className="lg:hidden mb-4">
      <Link href={to}>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2" data-testid="button-mobile-back">
          <ArrowLeft size={18} />
          <span>{label}</span>
        </Button>
      </Link>
    </div>
  );
}
