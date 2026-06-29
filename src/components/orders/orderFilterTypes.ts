export type OrderTypeFilter = 'all' | 'subscription' | 'one_time';
export type OrderStatusFilter = 'all' | 'active' | 'delivered' | 'cancelled';
export type DatePreset = 'all' | '7d' | '30d' | '3m' | 'custom';

export interface OrderFilterState {
  type: OrderTypeFilter;
  status: OrderStatusFilter;
  datePreset: DatePreset;
  customFrom?: string;
  customTo?: string;
}

export const DEFAULT_ORDER_FILTERS: OrderFilterState = {
  type: 'all',
  status: 'all',
  datePreset: 'all',
};

export interface OrderFiltersProps {
  value: OrderFilterState;
  onChange: (next: OrderFilterState) => void;
}

export function hasActiveOrderFilters(filters: OrderFilterState): boolean {
  return filters.type !== 'all' || filters.status !== 'all' || filters.datePreset !== 'all';
}
