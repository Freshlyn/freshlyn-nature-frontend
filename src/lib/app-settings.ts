/**
 * The contract for public.app_settings: the constants an operator can retune
 * from the Supabase dashboard without a deploy.
 *
 * Every setting is declared here with its fallback, and the fallback is the
 * shipped default rather than a placeholder. A missing row, a failed fetch and
 * an offline start all resolve to these values, so the site renders correct
 * numbers even when the table is unreachable -- the DB overrides the code, it
 * is not a prerequisite for it.
 *
 * Keys are the primary key of the table verbatim. The parsers are what keep a
 * malformed dashboard edit ("30/-", an empty string, a deleted value) from
 * reaching the UI as NaN: a value that does not parse is discarded in favour of
 * the fallback.
 */
import { z } from "zod";
import { DEFAULT_BANNERS, type BannerContent } from "@/lib/banner-content";
import { DEFAULT_CONTACT, DEFAULT_PRIVACY, DEFAULT_TERMS } from "@/lib/legal-content";
import { DELIVERY_SLOTS } from "@/lib/delivery-slots";
import { DEFAULT_SELLER } from "@/lib/seller-content";

/** A positive rupee amount. Rejects NaN, negatives and non-numbers. */
const money = z.number().finite().nonnegative();

/**
 * One hero card. Mirrors BannerContent in banner-content.ts, but as a runtime
 * validator rather than a compile-time type: these rows are operator-edited, so
 * the shape has to be checked when it arrives, not merely declared.
 *
 * The enums are the load-bearing part. `icon` and `theme` are keys that
 * HomeBanner resolves to components and Tailwind classes, so an unrecognised
 * value would render `undefined` as a component and crash the carousel. A row
 * that fails this check is discarded in favour of DEFAULT_BANNERS.
 */
const bannerSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  accentText: z.string(),
  subtitle: z.string(),
  pills: z.array(
    z.object({
      icon: z.enum(["truck", "clock", "milk", "gift"]),
      label: z.string(),
    }),
  ),
  imageUrl: z.string().url(),
  imageAlt: z.string(),
  theme: z.enum(["green", "amber"]),
  enabled: z.boolean().optional(),
});

/**
 * A legal page: /terms and /privacy share this shape.
 *
 * Headings carry no numbers -- numberSections derives them from position, so a
 * section inserted in the dashboard renumbers the rest. An empty heading marks
 * a continuation block and is skipped by the numbering.
 *
 * Deliberately permissive about empty strings and absent lists: this is
 * operator-authored prose, and rejecting a section for having no bullet list
 * would discard a whole document over a formatting choice.
 */
const legalSectionSchema = z.object({
  heading: z.string(),
  paragraphs: z.array(z.string()).optional(),
  list: z.array(z.string()).optional(),
});

const legalDocumentSchema = z.object({
  lastUpdated: z.string(),
  intro: z.string(),
  sections: z.array(legalSectionSchema),
  closing: z.string(),
});

const contactSchema = z.object({
  address: z.string(),
  email: z.string(),
  website: z.string(),
  supportPhone: z.string(),
  supportPhoneDisplay: z.string(),
  supportEmail: z.string(),
  supportHours: z.string(),
});

/**
 * A delivery window. `value` is the start and is the only field anything
 * downstream reads -- orders.delivery_slot is a Postgres `time` and every
 * scheduled_at is derived from it. `endValue` is presentation only.
 *
 * The regex is the guard that matters: these land in a `time` column, so a
 * value that is not "HH:MM" would reach SQL as a cast error at checkout rather
 * than as a validation failure here.
 */
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be 24-hour HH:MM");

const deliverySlotSchema = z
  .object({
    value: timeOfDay,
    endValue: timeOfDay,
    shift: z.enum(["morning", "evening"]),
  })
  // A window that ends before it starts would render backwards and describe a
  // commitment nobody can keep.
  .refine((s) => s.endValue > s.value, {
    message: "endValue must be after value",
  });

/**
 * The seller of record, printed on every downloaded receipt.
 *
 * `gstin` and `fssai` are optional and default to empty, which is what keeps
 * the document a Bill of Supply rather than a Tax Invoice -- see receipt.ts.
 * They are strings, not booleans, precisely so an operator can switch the
 * document over by typing the real number into the dashboard.
 */
const sellerSchema = z.object({
  legalName: z.string().min(1),
  tradeName: z.string().min(1),
  addressLines: z.array(z.string()),
  email: z.string(),
  phoneDisplay: z.string(),
  gstin: z.string().default(""),
  fssai: z.string().default(""),
});

export const SETTINGS_SCHEMA = {
  delivery_fee: { schema: money, fallback: 30 },
  free_delivery_threshold: { schema: money, fallback: 299 },
  banners: { schema: z.array(bannerSchema), fallback: DEFAULT_BANNERS },
  // Delivery windows. Editable from the dashboard, but note the edge function
  // keeps its own mirrored allowlist -- see _shared/delivery-slots.ts.
  delivery_slots: { schema: z.array(deliverySlotSchema).min(1), fallback: DELIVERY_SLOTS },
  // Legal copy. The code fallbacks are the text that shipped, so a failed
  // fetch renders the real policy rather than a blank page -- these documents
  // are a compliance surface and must never come up empty.
  terms: { schema: legalDocumentSchema, fallback: DEFAULT_TERMS },
  privacy: { schema: legalDocumentSchema, fallback: DEFAULT_PRIVACY },
  // One row, read by both pages, replacing the block that was duplicated
  // verbatim in each.
  contact: { schema: contactSchema, fallback: DEFAULT_CONTACT },
  // Who the receipt says sold the goods. Deliberately separate from
  // `contact`: that row is how to reach support, this one is the entity of
  // record, and the two diverge as soon as the registered name differs from
  // the brand name.
  seller: { schema: sellerSchema, fallback: DEFAULT_SELLER },
} as const;

export type SettingKey = keyof typeof SETTINGS_SCHEMA;

export type AppSettings = {
  [K in SettingKey]: z.infer<(typeof SETTINGS_SCHEMA)[K]["schema"]>;
};

/** The shipped defaults, used until the first fetch lands and whenever it fails. */
export const DEFAULT_SETTINGS: AppSettings = Object.fromEntries(
  Object.entries(SETTINGS_SCHEMA).map(([key, spec]) => [key, spec.fallback]),
) as AppSettings;

/**
 * Fold raw `{key, value}` rows into a settings object.
 *
 * Unknown keys are ignored rather than merged: the dashboard may hold settings
 * a given client build does not know about yet (an older app version in a
 * customer's browser), and those must not become properties nothing validated.
 */
export function parseSettingsRows(
  rows: ReadonlyArray<{ key: string; value: unknown }>,
): AppSettings {
  const settings = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    if (!(row.key in SETTINGS_SCHEMA)) continue;
    const key = row.key as SettingKey;
    const parsed = SETTINGS_SCHEMA[key].schema.safeParse(row.value);
    if (parsed.success) {
      // The cast is confined to this line and is the only unchecked step in the
      // module. TypeScript cannot see that SETTINGS_SCHEMA[key] and
      // settings[key] name the same entry, so it widens both sides to a union
      // and demands their intersection -- but safeParse has just proved the
      // value matches this key's own schema, which is exactly the guarantee the
      // assignment needs.
      (settings as Record<SettingKey, unknown>)[key] = parsed.data;
    }
  }

  return settings;
}

/**
 * The delivery fee for a given subtotal.
 *
 * Sole owner of the free-delivery rule. It lives here, beside the settings it
 * reads, because the cart and the checkout edge function must apply it
 * identically -- they previously did not, and an order under the threshold was
 * shown one fee and charged another.
 *
 * Strictly greater than: a subtotal exactly equal to the threshold still pays.
 * That matches the comparison the cart has always used and is documented on the
 * seeded row.
 */
export function deliveryFeeFor(subtotal: number, settings: AppSettings): number {
  return subtotal > settings.free_delivery_threshold ? 0 : settings.delivery_fee;
}

/**
 * Substitute `{setting_key}` placeholders in banner copy with live values.
 *
 * Exists so a banner pill can say "Free over ₹299" without that 299 being a
 * second, independently-editable copy of free_delivery_threshold -- retuning
 * the threshold would otherwise leave the pill advertising the old number.
 *
 * Only the numeric settings interpolate, and an unknown key is left untouched
 * rather than replaced with "undefined": a literal brace in ordinary copy
 * should survive unharmed.
 */
export function interpolate(text: string, settings: AppSettings): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = settings[key as SettingKey];
    return typeof value === "number" ? String(value) : whole;
  });
}

/**
 * The banners to actually render: enabled ones, with their copy interpolated.
 *
 * `enabled !== false` rather than `enabled === true` so a row that omits the
 * flag entirely still shows -- an operator adding a banner should not have to
 * know the field exists.
 */
export function visibleBanners(settings: AppSettings): BannerContent[] {
  return settings.banners
    .filter((banner) => banner.enabled !== false)
    .map((banner) => ({
      ...banner,
      title: interpolate(banner.title, settings),
      accentText: interpolate(banner.accentText, settings),
      subtitle: interpolate(banner.subtitle, settings),
      pills: banner.pills.map((pill) => ({
        ...pill,
        label: interpolate(pill.label, settings),
      })),
    }));
}
