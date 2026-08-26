import type { SubscriptionDelivery } from "@/hooks/use-orders";

const DELIVERY_ZONE = "Asia/Kolkata";

/**
 * The stored due time for a delivery, rendered in the delivery city's zone.
 *
 * scheduled_at is a timestamptz, so formatting it with the viewer's local zone
 * would show a customer abroad a different time than the rider is given.
 */
export function formatScheduledTime(delivery?: SubscriptionDelivery): string | null {
  if (!delivery?.scheduled_at) return null;
  // en-US, not en-IN: the zone is pinned below regardless of locale, and
  // en-IN renders a lowercase "am"/"pm" that reads as a typo beside the rest
  // of the UI.
  return new Date(delivery.scheduled_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: DELIVERY_ZONE,
  });
}

/**
 * When a one-time item is expected, e.g. "Wed, Aug 26 · 7:00 AM".
 *
 * Reads only what the backend stored. Returns null rather than a stand-in when
 * no delivery row exists -- orders placed before the schedule was persisted
 * genuinely have no recorded date, and computing one in the browser is the bug
 * the stored schedule replaced.
 */
export function formatExpectedDelivery(
  deliveries: SubscriptionDelivery[] | undefined,
): string | null {
  if (!deliveries || deliveries.length === 0) return null;

  const first = [...deliveries].sort((a, b) => a.sequence_number - b.sequence_number)[0];
  if (!first?.scheduled_date) return null;

  // scheduled_date is a plain `date`. `new Date("2026-08-26")` parses it as
  // UTC midnight, which formats as the 25th for any viewer west of Greenwich,
  // so the parts are read out and rebuilt as a local date.
  const [year, month, day] = first.scheduled_date.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  const datePart = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const timePart = formatScheduledTime(first);
  return timePart ? `${datePart} · ${timePart}` : datePart;
}

/** The tile label for each terminal state, keyed by the row's stored status. */
const STATUS_LABELS: Record<SubscriptionDelivery["status"], string> = {
  scheduled: "Expected by",
  delivered: "Delivered on",
  skipped: "Skipped on",
  cancelled: "Cancelled",
};

export interface DeliveryBadge {
  text: string;
  tone: "positive" | "negative";
}

export interface OneTimeDeliverySummary {
  /** Tile label, e.g. "Expected by" -- reflects status, never the date. */
  label: string;
  /** Formatted date and slot time. */
  value: string;
  /**
   * Status badge, or null while merely scheduled.
   *
   * The one-time card renders no timeline marker, so this is what carries the
   * delivered/skipped distinction -- and it carries it in text, not colour
   * alone, which a dot shade cannot do for anyone who cannot separate the two.
   */
  badge: DeliveryBadge | null;
  /** The row itself, so the caller can render its marker state. */
  delivery: SubscriptionDelivery;
}

/**
 * The single delivery behind a one-time item, described for display.
 *
 * The label follows the row's stored status rather than comparing its date to
 * today: an overdue-but-still-scheduled row must not be relabelled "Delivered
 * on" merely because its date has passed.
 */
export function describeOneTimeDelivery(
  deliveries: SubscriptionDelivery[] | undefined,
): OneTimeDeliverySummary | null {
  if (!deliveries || deliveries.length === 0) return null;

  const delivery = [...deliveries].sort((a, b) => a.sequence_number - b.sequence_number)[0];
  const value = formatExpectedDelivery(deliveries);
  if (!delivery || !value) return null;

  const badge: DeliveryBadge | null =
    delivery.status === "scheduled"
      ? null
      : { text: delivery.status, tone: delivery.status === "delivered" ? "positive" : "negative" };

  return {
    label: STATUS_LABELS[delivery.status] ?? STATUS_LABELS.scheduled,
    value,
    badge,
    delivery,
  };
}
