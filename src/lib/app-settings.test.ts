import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  deliveryFeeFor,
  interpolate,
  parseSettingsRows,
  visibleBanners,
} from "@/lib/app-settings";
import { numberSections } from "@/lib/legal-content";
import { formatDeliverySlot, slotLabel } from "@/lib/delivery-slots";

describe("parseSettingsRows", () => {
  it("reads values from rows", () => {
    const settings = parseSettingsRows([
      { key: "delivery_fee", value: 45 },
      { key: "free_delivery_threshold", value: 500 },
    ]);
    expect(settings.delivery_fee).toBe(45);
    expect(settings.free_delivery_threshold).toBe(500);
  });

  it("falls back per-key when a row is malformed", () => {
    // A dashboard edit that typed "30/-" into the value must not take the
    // valid row down with it, nor surface as NaN in the cart.
    const settings = parseSettingsRows([
      { key: "delivery_fee", value: "30/-" },
      { key: "free_delivery_threshold", value: 400 },
    ]);
    expect(settings.delivery_fee).toBe(DEFAULT_SETTINGS.delivery_fee);
    expect(settings.free_delivery_threshold).toBe(400);
  });

  it("ignores keys the build does not know about", () => {
    const settings = parseSettingsRows([{ key: "future_flag", value: 1 }]);
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects a banner whose theme is not a known key", () => {
    // theme resolves to Tailwind classes via a lookup; an unknown key would
    // render undefined and break the carousel, so the whole value is discarded.
    const settings = parseSettingsRows([
      {
        key: "banners",
        value: [{ ...DEFAULT_SETTINGS.banners[0], theme: "neon" }],
      },
    ]);
    expect(settings.banners).toEqual(DEFAULT_SETTINGS.banners);
  });
});

describe("deliveryFeeFor", () => {
  it("charges the fee at and below the threshold, waives it above", () => {
    const s = { ...DEFAULT_SETTINGS, delivery_fee: 30, free_delivery_threshold: 299 };
    expect(deliveryFeeFor(298, s)).toBe(30);
    expect(deliveryFeeFor(299, s)).toBe(30);
    expect(deliveryFeeFor(300, s)).toBe(0);
  });
});

describe("interpolate", () => {
  it("substitutes a numeric setting", () => {
    expect(interpolate("Free over ₹{free_delivery_threshold}", DEFAULT_SETTINGS)).toBe(
      "Free over ₹299",
    );
  });

  it("leaves an unknown placeholder untouched rather than writing undefined", () => {
    expect(interpolate("{not_a_setting}", DEFAULT_SETTINGS)).toBe("{not_a_setting}");
  });
});

describe("visibleBanners", () => {
  it("drops disabled rows and keeps ones with no flag", () => {
    // Built from an explicit pair rather than DEFAULT_SETTINGS: every shipped
    // banner is enabled now that the milk offer is honoured, so the real set
    // no longer exercises the disabled branch.
    const settings = {
      ...DEFAULT_SETTINGS,
      banners: [
        { ...DEFAULT_SETTINGS.banners[0], id: "no-flag", enabled: undefined },
        { ...DEFAULT_SETTINGS.banners[0], id: "parked", enabled: false },
      ],
    };
    const ids = visibleBanners(settings).map((b) => b.id);
    expect(ids).toContain("no-flag");
    expect(ids).not.toContain("parked");
  });

  it("shows the milk offer, which checkout now honours via discount_percent", () => {
    const ids = visibleBanners(DEFAULT_SETTINGS).map((b) => b.id);
    expect(ids).toContain("fast-delivery");
    expect(ids).toContain("milk-subscription");
  });

  it("resolves placeholders in pill copy", () => {
    const [first] = visibleBanners({ ...DEFAULT_SETTINGS, free_delivery_threshold: 249 });
    expect(first.pills[0].label).toBe("Free over ₹249");
  });
});

describe("numberSections", () => {
  it("numbers headed sections consecutively and skips continuations", () => {
    // Several real terms sections carry an empty heading: they continue the
    // block above and must not consume a number, or everything after them
    // would be off by one.
    const numbered = numberSections([
      { heading: "First" },
      { heading: "" },
      { heading: "Second" },
    ]);
    expect(numbered.map((n) => n.number)).toEqual([1, null, 2]);
  });

  it("renumbers automatically when a section is inserted", () => {
    const before = numberSections([{ heading: "A" }, { heading: "B" }]);
    const after = numberSections([{ heading: "A" }, { heading: "New" }, { heading: "B" }]);
    expect(before.map((n) => n.number)).toEqual([1, 2]);
    // B moves from 2 to 3 with no edit to its stored heading.
    expect(after.map((n) => n.number)).toEqual([1, 2, 3]);
  });
});

describe("legal settings", () => {
  it("falls back to the shipped policy when the row is malformed", () => {
    // A legal page must never render blank -- it is a compliance surface.
    const settings = parseSettingsRows([{ key: "terms", value: { intro: "oops" } }]);
    expect(settings.terms).toEqual(DEFAULT_SETTINGS.terms);
    expect(settings.terms.sections.length).toBeGreaterThan(0);
  });

  it("accepts a well-formed replacement document", () => {
    const replacement = {
      lastUpdated: "January 1, 2027",
      intro: "New intro.",
      sections: [{ heading: "Only Section", paragraphs: ["Body."] }],
      closing: "Bye.",
    };
    const settings = parseSettingsRows([{ key: "terms", value: replacement }]);
    expect(settings.terms).toEqual(replacement);
  });
});

describe("support contact", () => {
  it("keeps the two mailboxes distinct", () => {
    // freshlynnature.com (legal) and freshlynature.com (support) differ by one
    // letter and are deliberately separate addresses -- neither can be derived
    // from the other, so both must survive a round trip.
    const { contact } = DEFAULT_SETTINGS;
    expect(contact.email).toBe("info@freshlynnature.com");
    expect(contact.supportEmail).toBe("info@freshlynature.com");
    expect(contact.email).not.toBe(contact.supportEmail);
  });

  it("stores the support number in a dialable E.164 form", () => {
    // tel: needs no separators; the display form is what users read.
    expect(DEFAULT_SETTINGS.contact.supportPhone).toMatch(/^\+\d+$/);
    expect(DEFAULT_SETTINGS.contact.supportPhoneDisplay).toContain(" ");
  });

  it("falls back to the shipped contact when a field is missing", () => {
    const settings = parseSettingsRows([
      { key: "contact", value: { address: "a", email: "b", website: "c" } },
    ]);
    expect(settings.contact).toEqual(DEFAULT_SETTINGS.contact);
  });
});

describe("delivery windows", () => {
  it("stores only the window start, which is what gets scheduled", () => {
    // orders.delivery_slot is a Postgres `time` and scheduled_at is derived as
    // scheduled_date + delivery_slot, so a range cannot be stored -- the start
    // is the value and the end is presentation only.
    const [first] = DEFAULT_SETTINGS.delivery_slots;
    expect(first.value).toBe("06:00");
    expect(first.endValue).toBe("08:00");
  });

  it("renders a window as a range", () => {
    expect(slotLabel({ value: "06:00", endValue: "08:00", shift: "morning" })).toBe(
      "6:00 AM - 8:00 AM",
    );
    expect(slotLabel({ value: "16:00", endValue: "18:00", shift: "evening" })).toBe(
      "4:00 PM - 6:00 PM",
    );
  });

  it("rejects a window that ends before it starts", () => {
    const settings = parseSettingsRows([
      { key: "delivery_slots", value: [{ value: "10:00", endValue: "08:00", shift: "morning" }] },
    ]);
    expect(settings.delivery_slots).toEqual(DEFAULT_SETTINGS.delivery_slots);
  });

  it("rejects a slot value that is not a 24-hour time", () => {
    // These are interpolated into a `time` column; a bad value would surface as
    // a SQL cast error mid-checkout rather than a clean rejection.
    const settings = parseSettingsRows([
      { key: "delivery_slots", value: [{ value: "6 AM", endValue: "08:00", shift: "morning" }] },
    ]);
    expect(settings.delivery_slots).toEqual(DEFAULT_SETTINGS.delivery_slots);
  });

  it("accepts a well-formed replacement window set", () => {
    const replacement = [{ value: "13:00", endValue: "15:00", shift: "evening" as const }];
    const settings = parseSettingsRows([{ key: "delivery_slots", value: replacement }]);
    expect(settings.delivery_slots).toEqual(replacement);
  });

  it("falls back to a bare time for a window no longer offered", () => {
    // Historical orders keep values from windows that may since have changed;
    // their slot must still render rather than going blank.
    expect(formatDeliverySlot("07:30")).toBe("7:30 AM");
    expect(formatDeliverySlot("06:00")).toBe("6:00 AM - 8:00 AM");
    // Postgres returns "HH:MM:SS" for a time column.
    expect(formatDeliverySlot("18:00:00")).toBe("6:00 PM - 8:00 PM");
  });
});
