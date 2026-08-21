/**
 * The delivery slots a customer can choose at checkout.
 *
 * `value` is what crosses the wire and lands in Postgres `time` columns, so it
 * is 24-hour "HH:MM" -- not the "7:00 AM" display string the cart used to hold,
 * which no time column will accept. `label` is the display form. Keeping both on
 * one record is what stops the two from drifting apart.
 *
 * Shift is derived, never stored: a slot's hour already says whether it is
 * morning or evening, and a second stored column could contradict the first.
 */
export type DeliveryShift = "morning" | "evening";

export interface DeliverySlot {
  value: string;
  label: string;
  shift: DeliveryShift;
}

export const DELIVERY_SLOTS: readonly DeliverySlot[] = [
  { value: "06:00", label: "6:00 AM", shift: "morning" },
  { value: "06:30", label: "6:30 AM", shift: "morning" },
  { value: "07:00", label: "7:00 AM", shift: "morning" },
  { value: "07:30", label: "7:30 AM", shift: "morning" },
  { value: "08:00", label: "8:00 AM", shift: "morning" },
  { value: "08:30", label: "8:30 AM", shift: "morning" },
  { value: "09:00", label: "9:00 AM", shift: "morning" },
  { value: "09:30", label: "9:30 AM", shift: "morning" },
  { value: "10:00", label: "10:00 AM", shift: "morning" },
  { value: "16:00", label: "4:00 PM", shift: "evening" },
  { value: "16:30", label: "4:30 PM", shift: "evening" },
  { value: "17:00", label: "5:00 PM", shift: "evening" },
  { value: "17:30", label: "5:30 PM", shift: "evening" },
  { value: "18:00", label: "6:00 PM", shift: "evening" },
  { value: "18:30", label: "6:30 PM", shift: "evening" },
  { value: "19:00", label: "7:00 PM", shift: "evening" },
  { value: "19:30", label: "7:30 PM", shift: "evening" },
  { value: "20:00", label: "8:00 PM", shift: "evening" },
];

export const DEFAULT_DELIVERY_SLOT = "07:00";

export const MORNING_SLOTS = DELIVERY_SLOTS.filter((s) => s.shift === "morning");
export const EVENING_SLOTS = DELIVERY_SLOTS.filter((s) => s.shift === "evening");

export function isValidDeliverySlot(value: string): boolean {
  return DELIVERY_SLOTS.some((slot) => slot.value === value);
}

/**
 * Formats a stored slot for display. Accepts the "HH:MM:SS" that Postgres
 * returns for a `time` column as well as the "HH:MM" the client sends.
 */
export function formatDeliverySlot(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.slice(0, 5);
  return DELIVERY_SLOTS.find((slot) => slot.value === normalized)?.label ?? null;
}
