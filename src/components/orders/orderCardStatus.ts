import { Truck, CheckCircle, XCircle, AlertCircle, type LucideIcon } from 'lucide-react';
import type { OrderStatus } from '@/hooks/use-orders';

export type DisplayStatus = 'active' | 'delivered' | 'failed' | 'cancelled';

interface StatusMeta {
  icon: LucideIcon;
  label: string;
  badgeBg: string;
  badgeText: string;
  dot: string;
}

export const displayStatusMeta: Record<DisplayStatus, StatusMeta> = {
  active: {
    icon: Truck,
    label: 'Active',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-700',
    dot: 'bg-orange-500',
  },
  delivered: {
    icon: CheckCircle,
    label: 'Delivered',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  failed: {
    icon: AlertCircle,
    label: 'Delivery failed',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  cancelled: {
    icon: XCircle,
    label: 'Cancelled',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
    dot: 'bg-red-500',
  },
};

export function getDisplayStatus(status: OrderStatus): DisplayStatus {
  if (status === 'delivered') return 'delivered';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  return 'active';
}
