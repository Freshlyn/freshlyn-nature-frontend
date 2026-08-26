import { describe, it, expect } from "vitest";
import { describeOneTimeDelivery, formatExpectedDelivery } from "@/lib/delivery-estimate";
import type { SubscriptionDelivery } from "@/hooks/use-orders";

function delivery(overrides: Partial<SubscriptionDelivery> = {}): SubscriptionDelivery {
  return {
    id: "sd_1",
    sequence_number: 1,
    scheduled_date: "2026-08-26",
    scheduled_at: "2026-08-26T01:30:00Z", // 07:00 IST
    status: "scheduled",
    ...overrides,
  };
}

describe("formatExpectedDelivery", () => {
  it("renders the scheduled date with its slot time", () => {
    expect(formatExpectedDelivery([delivery()])).toBe("Wed, Aug 26 · 7:00 AM");
  });

  it("renders the date alone when no slot time was stored", () => {
    // Orders placed before delivery_slot existed have a date but no instant.
    // A date on its own is still useful; inventing a time is not.
    expect(formatExpectedDelivery([delivery({ scheduled_at: null })])).toBe("Wed, Aug 26");
  });

  it("returns null when the item has no delivery row", () => {
    // Pre-migration orders never had one written. Showing nothing beats
    // computing a stand-in, which is the bug the stored schedule replaced.
    expect(formatExpectedDelivery([])).toBeNull();
    expect(formatExpectedDelivery(undefined)).toBeNull();
  });

  it("uses the earliest sequence, not the array order", () => {
    // The nested join returns rows in no guaranteed order.
    const rows = [
      delivery({ id: "sd_2", sequence_number: 2, scheduled_date: "2026-08-28", scheduled_at: null }),
      delivery({ id: "sd_1", sequence_number: 1, scheduled_date: "2026-08-26", scheduled_at: null }),
    ];
    expect(formatExpectedDelivery(rows)).toBe("Wed, Aug 26");
  });

  it("renders the slot time in delivery-city time, not the viewer's zone", () => {
    // A customer abroad must see the time the rider was given.
    const original = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      expect(formatExpectedDelivery([delivery()])).toContain("7:00 AM");
    } finally {
      process.env.TZ = original;
    }
  });

  it("does not shift the date across a zone boundary", () => {
    // scheduled_date is a plain date. Parsing it as UTC and formatting it
    // locally moves it a day back for anyone west of Greenwich.
    const original = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      expect(formatExpectedDelivery([delivery({ scheduled_at: null })])).toBe("Wed, Aug 26");
    } finally {
      process.env.TZ = original;
    }
  });
});

describe("describeOneTimeDelivery", () => {
  it("labels a scheduled delivery as expected", () => {
    const d = delivery();
    expect(describeOneTimeDelivery([d])).toEqual({
      label: "Expected by",
      value: "Wed, Aug 26 · 7:00 AM",
      badge: null,
      delivery: d,
    });
  });

  it("switches the label once the row is delivered", () => {
    // The tile must not keep promising a future delivery after it has landed.
    const d = delivery({ status: "delivered" });
    expect(describeOneTimeDelivery([d])?.label).toBe("Delivered on");
  });

  it("labels a skipped delivery rather than claiming it is expected", () => {
    expect(describeOneTimeDelivery([delivery({ status: "skipped" })])?.label).toBe("Skipped on");
  });

  it("labels a cancelled delivery", () => {
    expect(describeOneTimeDelivery([delivery({ status: "cancelled" })])?.label).toBe("Cancelled");
  });

  it("returns null when nothing was recorded", () => {
    expect(describeOneTimeDelivery([])).toBeNull();
    expect(describeOneTimeDelivery(undefined)).toBeNull();
  });
});

describe("describeOneTimeDelivery badges", () => {
  it("carries no badge while the delivery is merely scheduled", () => {
    // Nothing has happened yet -- a badge would assert a state that has not
    // been recorded.
    expect(describeOneTimeDelivery([delivery()])?.badge).toBeNull();
  });

  it("badges a settled delivery, replacing the timeline marker it lost", () => {
    // The one-time card renders no timeline row, so the badge is the only
    // thing distinguishing delivered from skipped without relying on colour.
    expect(describeOneTimeDelivery([delivery({ status: "delivered" })])?.badge).toEqual({
      text: "delivered",
      tone: "positive",
    });
    expect(describeOneTimeDelivery([delivery({ status: "skipped" })])?.badge).toEqual({
      text: "skipped",
      tone: "negative",
    });
    expect(describeOneTimeDelivery([delivery({ status: "cancelled" })])?.badge).toEqual({
      text: "cancelled",
      tone: "negative",
    });
  });
});
