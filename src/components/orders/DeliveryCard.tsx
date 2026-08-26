import type { SubscriptionDelivery } from "@/hooks/use-orders";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar, CheckCircle, XCircle } from "lucide-react";
import { formatScheduledTime, type DeliveryBadge } from "@/lib/delivery-estimate";
import { isBefore, isToday, startOfDay } from "date-fns";

/**
 * The delivery card's shared vocabulary.
 *
 * A one-time item is a schedule of exactly one delivery, so both item types
 * render the same surface, heading, stat tiles and timeline markers. Keeping
 * these as one set of components is what stops the two halves of a mixed order
 * drifting apart visually -- the previous one-time treatment was a bare line of
 * text that read as part of the product metadata above it.
 */

export function DeliveryCardShell({
  title,
  children,
  testId,
}: {
  title: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <Card className="p-4 mt-3 bg-emerald-50/50 border-emerald-200/60" data-testid={testId}>
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={16} className="text-emerald-600" />
        <h4 className="font-semibold text-sm text-emerald-800">{title}</h4>
      </div>
      {children}
    </Card>
  );
}

export function DeliveryStat({
  label,
  value,
  /** Spans both columns and sets the value at display weight. */
  wide = false,
  badge,
  testId,
}: {
  label: string;
  value: string;
  wide?: boolean;
  badge?: DeliveryBadge | null;
  testId?: string;
}) {
  return (
    <div
      className={`bg-white rounded-lg p-2.5 border border-emerald-100 ${wide ? "col-span-2" : ""}`}
    >
      <span className="text-muted-foreground block">{label}</span>
      <span className="flex items-center gap-2 flex-wrap">
        <span
          className={`font-semibold text-foreground ${wide ? "font-display text-[15px]" : ""}`}
          data-testid={testId}
        >
          {value}
        </span>
        {badge && (
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4 capitalize ${
              badge.tone === "positive"
                ? "border-emerald-300 text-emerald-700"
                : "border-red-300 text-red-600"
            }`}
            data-testid={testId ? `${testId}-badge` : undefined}
          >
            {badge.text}
          </Badge>
        )}
      </span>
    </div>
  );
}

export function DeliveryStatGrid({
  children,
  /** Bottom margin only when a timeline follows; the one-time card has none. */
  spaced = true,
}: {
  children: React.ReactNode;
  spaced?: boolean;
}) {
  return (
    <div className={`grid grid-cols-2 gap-3 text-xs ${spaced ? "mb-4" : ""}`}>{children}</div>
  );
}

/**
 * One row of the timeline.
 *
 * Marker state comes from the row's stored status, never from its date: a row
 * delivered ahead of schedule must still read as delivered, and a past date
 * still sitting at 'scheduled' must not render a tick claiming a delivery that
 * never happened.
 */
export function DeliveryTimelineRow({
  delivery,
  showConnector,
  index,
  todayLabel = "Today",
}: {
  delivery: SubscriptionDelivery;
  showConnector: boolean;
  index: number;
  /** Overridden to "Tomorrow" where a single upcoming delivery reads better. */
  todayLabel?: string;
}) {
  const date = startOfDay(new Date(delivery.scheduled_date));
  const today = startOfDay(new Date());
  const isTodayDate = isToday(date);

  const isDelivered = delivery.status === "delivered";
  const isSkipped = delivery.status === "skipped";
  const isCancelled = delivery.status === "cancelled";
  const isSettled = isDelivered || isSkipped || isCancelled;

  // Overdue but still 'scheduled' stays neutral: nothing has been recorded
  // against it either way, so asserting a miss would be a guess from the date.
  const isPast = isBefore(date, today) && !isTodayDate;
  const isDimmed = isPast || isSettled;

  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex items-center gap-3 relative" data-testid={`delivery-date-${index}`}>
      {showConnector && (
        <div
          className={`absolute left-[9px] top-[22px] w-0.5 h-full ${
            isDelivered ? "bg-emerald-300" : "bg-gray-200"
          }`}
        />
      )}
      <div
        className={`w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
          isSkipped || isCancelled
            ? "bg-red-400"
            : isDelivered
              ? "bg-emerald-500"
              : isTodayDate
                ? "bg-gray-200 ring-2 ring-emerald-200"
                : "bg-gray-200"
        }`}
      >
        {isSkipped || isCancelled ? (
          <XCircle size={12} className="text-white" />
        ) : isDelivered ? (
          <CheckCircle size={12} className="text-white" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-gray-400" />
        )}
      </div>
      <div
        className={`flex-1 flex items-center justify-between gap-2 py-2.5 ${
          isTodayDate ? "font-semibold" : ""
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs ${isDimmed ? "text-muted-foreground" : "text-foreground"}`}
            data-testid={`text-delivery-date-${index}`}
          >
            {dateLabel}
          </span>
          {isTodayDate && (
            <Badge
              variant="default"
              className="text-[10px] px-1.5 py-0 bg-emerald-600 h-4"
              data-testid={`badge-today-${index}`}
            >
              {todayLabel}
            </Badge>
          )}
          {/* Colour alone carried the delivered/skipped distinction, which is
              invisible to anyone who cannot separate the two dot shades. */}
          {isSettled && (
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 capitalize ${
                isDelivered ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-600"
              }`}
              data-testid={`badge-delivery-status-${index}`}
            >
              {delivery.status}
            </Badge>
          )}
        </div>
        <span
          className={`text-xs ${isDimmed ? "text-muted-foreground" : "text-foreground"}`}
          data-testid={`text-delivery-time-${index}`}
        >
          {formatScheduledTime(delivery) ?? "—"}
        </span>
      </div>
    </div>
  );
}
