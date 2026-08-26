/**
 * Deno-side mirror of src/lib/delivery-slots.ts.
 *
 * The edge function cannot import from the Vite app, and the slot is the
 * boundary where user input becomes a Postgres `time` value, so the allowlist
 * has to exist on the server independently of whatever the client sends.
 *
 * Only the START of a window is ever transmitted or stored: orders.delivery_slot
 * is a `time`, and create_order derives scheduled_at as
 * `scheduled_date + delivery_slot`. The window's end is presentation-only and
 * never reaches the server, so this list needs start times alone.
 *
 * These are the shipped defaults. checkout/handler.ts prefers the live
 * public.app_settings rows and falls back here, so a window added in the
 * dashboard is accepted without a redeploy -- but a settings read that fails
 * still leaves a working allowlist rather than rejecting every checkout.
 */
export const DELIVERY_SLOT_VALUES: readonly string[] = [
  "06:00",
  "08:00",
  "16:00",
  "18:00",
];

/** Shape of a window as stored in app_settings; only `value` is authoritative. */
export interface DeliverySlotSetting {
  value: string;
  endValue: string;
  shift: string;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The start times a checkout may use, taken from the live settings when they
 * parse and from the shipped list otherwise.
 *
 * Validates the shape here rather than trusting the row: these values are
 * interpolated into a `time` column, so a malformed one would surface as a SQL
 * cast error mid-order instead of a clean 400.
 */
export function allowedSlotValues(rows: unknown): readonly string[] {
  if (!Array.isArray(rows)) return DELIVERY_SLOT_VALUES;
  const values = rows
    .filter((r): r is DeliverySlotSetting =>
      !!r && typeof r === "object" && typeof (r as DeliverySlotSetting).value === "string"
    )
    .map((r) => r.value)
    .filter((v) => TIME_RE.test(v));
  return values.length > 0 ? values : DELIVERY_SLOT_VALUES;
}

export function isValidDeliverySlot(
  value: unknown,
  allowed: readonly string[] = DELIVERY_SLOT_VALUES,
): value is string {
  return typeof value === "string" && allowed.includes(value);
}
