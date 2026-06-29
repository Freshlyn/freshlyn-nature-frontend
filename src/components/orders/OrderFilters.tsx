import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { SlidersHorizontal, X, CalendarDays } from 'lucide-react';
import type { OrderFilterState, OrderFiltersProps, OrderTypeFilter, OrderStatusFilter, DatePreset } from './orderFilterTypes';

const TYPE_OPTIONS: { id: OrderTypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'one_time', label: 'One-Time' },
];

const STATUS_OPTIONS: { id: OrderStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

const DATE_OPTIONS: { id: DatePreset; label: string }[] = [
  { id: 'all', label: 'All Time' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '3m', label: 'Last 3 months' },
  { id: 'custom', label: 'Custom' },
];

function SheetPill<T extends string>({
  options,
  active,
  onSelect,
}: {
  options: { id: T; label: string }[];
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => {
        const isActive = active === opt.id;
        return (
          <button
            key={opt.id}
            data-testid={`order-filter-sheet-pill-${opt.id}`}
            onClick={() => onSelect(opt.id)}
            className={`px-3 py-2 rounded-xl font-semibold text-xs transition-all duration-300 border whitespace-nowrap ${
              isActive
                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30'
                : 'bg-white text-muted-foreground border-border hover:border-primary/30 hover:text-foreground active:scale-95'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function OrderFilters({ value, onChange }: OrderFiltersProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OrderFilterState>(value);
  const secondaryActiveCount = (value.status !== 'all' ? 1 : 0) + (value.datePreset !== 'all' ? 1 : 0);

  const typeIndex = TYPE_OPTIONS.findIndex((opt) => opt.id === value.type);

  const isDirty =
    draft.status !== value.status ||
    draft.datePreset !== value.datePreset ||
    draft.customFrom !== value.customFrom ||
    draft.customTo !== value.customTo;

  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(value);
    setOpen(next);
  };

  return (
    <div className="flex items-center gap-2 mb-5">
      <div className="relative inline-flex bg-muted/60 rounded-full p-1 flex-1">
        <div
          className="absolute top-1 bottom-1 rounded-full bg-white shadow-sm transition-[left] duration-300 ease-out"
          style={{
            left: `calc(0.25rem + ${typeIndex} * (100% - 0.5rem) / ${TYPE_OPTIONS.length})`,
            width: `calc((100% - 0.5rem) / ${TYPE_OPTIONS.length})`,
          }}
        />
        {TYPE_OPTIONS.map((opt) => {
          const isActive = value.type === opt.id;
          return (
            <button
              key={opt.id}
              data-testid={`order-filter-segment-${opt.id}`}
              onClick={() => onChange({ ...value, type: opt.id })}
              className={`relative z-10 flex-1 px-3 py-2 rounded-full text-xs font-semibold transition-colors duration-300 whitespace-nowrap ${
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Trigger asChild>
          <button
            data-testid="order-filter-open-sheet"
            className="relative flex items-center justify-center w-10 h-10 rounded-full border border-border bg-white hover:border-primary/30 hover:shadow-md active:scale-95 transition-all duration-300 flex-shrink-0"
          >
            <SlidersHorizontal size={16} className="text-foreground" />
            {secondaryActiveCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                {secondaryActiveCount}
              </span>
            )}
          </button>
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300"
            data-testid="order-filter-sheet"
          >
            <div className="flex items-center justify-between mb-5">
              <DialogPrimitive.Title className="text-lg font-display font-bold">Filters</DialogPrimitive.Title>
              <DialogPrimitive.Close className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60">
                <X size={16} />
              </DialogPrimitive.Close>
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Status</p>
                <SheetPill options={STATUS_OPTIONS} active={draft.status} onSelect={(status) => setDraft({ ...draft, status })} />
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Date Range</p>
                <SheetPill options={DATE_OPTIONS} active={draft.datePreset} onSelect={(datePreset) => setDraft({ ...draft, datePreset })} />

                {draft.datePreset === 'custom' && (
                  <div className="flex items-center gap-2 flex-wrap pt-3">
                    <CalendarDays size={14} className="text-muted-foreground" />
                    <input
                      type="date"
                      value={draft.customFrom ?? ''}
                      onChange={(e) => setDraft({ ...draft, customFrom: e.target.value })}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white"
                      data-testid="order-filter-date-from"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <input
                      type="date"
                      value={draft.customTo ?? ''}
                      onChange={(e) => setDraft({ ...draft, customTo: e.target.value })}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white"
                      data-testid="order-filter-date-to"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-7">
              <button
                onClick={() => setDraft({ ...draft, status: 'all', datePreset: 'all', customFrom: undefined, customTo: undefined })}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-border text-muted-foreground hover:border-primary/30 hover:text-foreground transition-all"
                data-testid="order-filter-sheet-clear"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  onChange(draft);
                  setOpen(false);
                }}
                disabled={!isDirty}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                  isDirty
                    ? 'bg-primary text-white shadow-lg shadow-primary/30 opacity-100 hover:scale-[1.02]'
                    : 'bg-muted text-muted-foreground opacity-60 cursor-not-allowed'
                }`}
                data-testid="order-filter-sheet-apply"
              >
                Apply
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}

export { DEFAULT_ORDER_FILTERS, hasActiveOrderFilters } from './orderFilterTypes';
