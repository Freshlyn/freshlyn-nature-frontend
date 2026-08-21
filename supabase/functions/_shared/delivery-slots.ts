/**
 * Deno-side mirror of src/lib/delivery-slots.ts.
 *
 * The edge function cannot import from the Vite app, and the slot list is the
 * boundary where user input becomes a Postgres `time` value, so the allowlist
 * has to exist on the server independently of whatever the client sends. Keep
 * the two lists in sync; the server one is authoritative.
 */
export const DELIVERY_SLOT_VALUES: readonly string[] = [
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
];

export function isValidDeliverySlot(value: unknown): value is string {
  return typeof value === "string" && DELIVERY_SLOT_VALUES.includes(value);
}
