/**
 * Deno-side mirror of src/lib/app-settings.ts.
 *
 * The edge function cannot import from the Vite app, and the delivery fee is
 * the figure the customer is actually charged, so the rule has to exist on the
 * server independently of whatever the client computed. Keep the two in sync;
 * this one is authoritative.
 *
 * Both sides read the same public.app_settings rows, which is the point: the
 * server previously hardcoded its own 50/5.00 while the cart displayed 299/30,
 * so an order under the threshold was shown one fee and charged another.
 */
export interface AppSettings {
  delivery_fee: number;
  free_delivery_threshold: number;
  /**
   * The delivery windows. Only `value` (the window's start) is authoritative --
   * it is what lands in the `time` column. Left as unknown[] because this
   * module does not need their shape; allowedSlotValues in delivery-slots.ts
   * validates and extracts.
   */
  delivery_slots: unknown[];
}

/**
 * The shipped defaults, matching src/lib/app-settings.ts and the seeded rows.
 *
 * A settings read that fails must not take checkout down with it, and it must
 * not silently make delivery free either -- so the fallback is the real fee,
 * not zero.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  delivery_fee: 30,
  free_delivery_threshold: 299,
  // Empty rather than a copy of the window list: allowedSlotValues falls back
  // to DELIVERY_SLOT_VALUES when this is empty, so the shipped allowlist lives
  // in exactly one place.
  delivery_slots: [],
};

function isMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Fold raw `{key, value}` rows into a settings object, falling back per-key.
 *
 * Per-key rather than all-or-nothing: one malformed row should not discard a
 * second, valid one.
 */
export function parseSettingsRows(
  rows: ReadonlyArray<{ key: string; value: unknown }>,
): AppSettings {
  const settings: AppSettings = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    if (row.key === "delivery_slots") {
      if (Array.isArray(row.value)) settings.delivery_slots = row.value;
      continue;
    }
    if (!isMoney(row.value)) continue;
    if (row.key === "delivery_fee") settings.delivery_fee = row.value;
    else if (row.key === "free_delivery_threshold") {
      settings.free_delivery_threshold = row.value;
    }
  }

  return settings;
}

/**
 * The delivery fee for a given subtotal. Mirrors deliveryFeeFor in
 * src/lib/app-settings.ts, including the strictly-greater-than comparison: a
 * subtotal exactly equal to the threshold still pays.
 */
export function deliveryFeeFor(subtotal: number, settings: AppSettings): number {
  return subtotal > settings.free_delivery_threshold ? 0 : settings.delivery_fee;
}
