import { Skeleton } from '@/components/ui/skeleton';

export function ProductCardSkeleton() {
  return (
    <div className="relative bg-white rounded-2xl overflow-hidden flex flex-col h-full border border-border/40">
      <div className="relative aspect-square overflow-hidden bg-muted/20">
        <Skeleton className="absolute inset-0 rounded-none bg-muted/40" />
        <Skeleton className="absolute top-2 left-2 h-5 w-14 rounded-lg bg-white/80" />
        <Skeleton className="absolute top-2 right-2 h-5 w-20 rounded-lg bg-white/80" />
      </div>

      <div className="p-3 flex flex-col flex-1">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2 mt-1" />
        </div>

        <div className="mt-3 pt-3 border-t border-border/50 flex items-end justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-5 w-14" />
          </div>
          <Skeleton className="h-9 w-16 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
