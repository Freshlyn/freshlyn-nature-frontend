/**
 * The delivery windows a customer can choose at checkout.
 *
 * A slot is a RANGE ("6:00 AM - 8:00 AM"), but `value` is its START time alone,
 * as 24-hour "HH:MM". That asymmetry is deliberate and load-bearing:
 * orders.delivery_slot is a Postgres `time`, and create_order derives every
 * subscription_deliveries.scheduled_at as `scheduled_date + delivery_slot`. A
 * range cannot be added to a date, so the start is what crosses the wire and
 * the window is presentation only. Widening a slot from 7:00 to 6:00-8:00
 * therefore changes what the customer reads, not what the scheduler computes.
 *
 * `endValue` exists so the label can be rebuilt from data rather than typed by
 * hand -- an operator editing a window in Supabase should not be able to make
 * the text and the times disagree.
 *
 * Shift is derived, never stored: a slot's start hour already says whether it
 * is morning or evening, and a second stored column could contradict the first.
 */
export type DeliveryShift = "morning" | "evening";

export interface DeliverySlot {
  /** Window start, "HH:MM". This is what is stored and scheduled against. */
  value: string;
  /** Window end, "HH:MM". Display only -- nothing downstream reads it. */
  endValue: string;
  shift: DeliveryShift;
}

/**
 * "06:00" -> "6:00 AM". Accepts the "HH:MM:SS" Postgres returns for a `time`
 * column as well as the "HH:MM" the client sends.
 */
export function formatTime(value: string): string {
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** The window's display form, e.g. "6:00 AM - 8:00 AM". */
export function slotLabel(slot: DeliverySlot): string {
  return `${formatTime(slot.value)} - ${formatTime(slot.endValue)}`;
}

export const DELIVERY_SLOTS: readonly DeliverySlot[] = [
  { value: "06:00", endValue: "08:00", shift: "morning" },
  { value: "08:00", endValue: "10:00", shift: "morning" },
  { value: "16:00", endValue: "18:00", shift: "evening" },
  { value: "18:00", endValue: "20:00", shift: "evening" },
];

export const DEFAULT_DELIVERY_SLOT = "06:00";

export const MORNING_SLOTS = DELIVERY_SLOTS.filter((s) => s.shift === "morning");
export const EVENING_SLOTS = DELIVERY_SLOTS.filter((s) => s.shift === "evening");

export function isValidDeliverySlot(value: string): boolean {
  return DELIVERY_SLOTS.some((slot) => slot.value === value);
}

/**
 * Formats a stored slot for display.
 *
 * Falls back to the bare start time when the value matches no current window.
 * Slots are operator-editable, so an order placed under a window that has since
 * been removed or retimed must still render its time rather than going blank --
 * the stored value remains a truthful record of what the customer chose.
 */
export function formatDeliverySlot(
  value: string | null | undefined,
  slots: readonly DeliverySlot[] = DELIVERY_SLOTS,
): string | null {
  if (!value) return null;
  const normalized = value.slice(0, 5);
  const slot = slots.find((s) => s.value === normalized);
  return slot ? slotLabel(slot) : formatTime(normalized);
}
