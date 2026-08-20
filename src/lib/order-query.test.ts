import { describe, it, expect } from "vitest";
import {
  statusesForFilter,
  dateRangeForFilter,
  keysetFilter,
  nextCursor,
  ORDERS_PAGE_SIZE,
} from "@/lib/order-query";
import { DEFAULT_ORDER_FILTERS } from "@/components/orders/orderFilterTypes";
import { ACTIVE_STATUSES, CANCELLED_STATUSES } from "@/lib/order-filters";

describe("statusesForFilter", () => {
  it("returns null for 'all' so the query stays unconstrained", () => {
    expect(statusesForFilter("all")).toBeNull();
  });

  it("mirrors the client-side status groups exactly", () => {
    expect(statusesForFilter("active")).toEqual(ACTIVE_STATUSES);
    expect(statusesForFilter("cancelled")).toEqual(CANCELLED_STATUSES);
    expect(statusesForFilter("delivered")).toEqual(["delivered"]);
  });

  it("keeps order.status.failed in the cancelled tab", () => {
    // Regression guard: `failed` has no tab of its own. If it stops riding
    // along with cancelled, those orders vanish from every tab.
    expect(statusesForFilter("cancelled")).toContain("failed");
  });
});

describe("dateRangeForFilter", () => {
  const now = new Date("2026-08-20T12:00:00.000Z").getTime();

  it("returns an empty range for 'all'", () => {
    expect(dateRangeForFilter(DEFAULT_ORDER_FILTERS, now)).toEqual({});
  });

  it("computes a lower bound for relative presets", () => {
    const { from, to } = dateRangeForFilter({ ...DEFAULT_ORDER_FILTERS, datePreset: "7d" }, now);
    expect(from).toBe(new Date("2026-08-13T12:00:00.000Z").toISOString());
    expect(to).toBeUndefined();
  });

  it("maps 3m to 90 days", () => {
    const { from } = dateRangeForFilter({ ...DEFAULT_ORDER_FILTERS, datePreset: "3m" }, now);
    expect(from).toBe(new Date("2026-05-22T12:00:00.000Z").toISOString());
  });

  it("extends a custom 'to' to the end of that day", () => {
    const { from, to } = dateRangeForFilter(
      {
        ...DEFAULT_ORDER_FILTERS,
        datePreset: "custom",
        customFrom: "2026-08-01",
        customTo: "2026-08-10",
      },
      now,
    );
    expect(from).toBe("2026-08-01T00:00:00.000Z");
    // An order at 18:00 on the 10th must still match.
    expect(new Date(to!).getTime()).toBeGreaterThan(new Date("2026-08-10T18:00:00Z").getTime());
    expect(new Date(to!).getTime()).toBeLessThan(new Date("2026-08-11T00:00:00Z").getTime());
  });

  it("omits bounds the user left blank in a custom range", () => {
    expect(
      dateRangeForFilter({ ...DEFAULT_ORDER_FILTERS, datePreset: "custom" }, now),
    ).toEqual({});
  });
});

describe("keysetFilter", () => {
  it("matches strictly-older rows and ties broken by id", () => {
    const f = keysetFilter({ createdAt: "2026-08-20T10:00:00.000Z", id: "abc" });
    expect(f).toBe(
      "created_at.lt.2026-08-20T10:00:00.000Z,and(created_at.eq.2026-08-20T10:00:00.000Z,id.lt.abc)",
    );
  });
});

describe("nextCursor", () => {
  const row = (id: string, created_at: string) => ({ id, created_at });

  it("returns null on a short page, ending the scroll", () => {
    expect(nextCursor([row("a", "2026-08-20T10:00:00Z")], ORDERS_PAGE_SIZE)).toBeNull();
  });

  it("returns null on an empty page", () => {
    expect(nextCursor([], ORDERS_PAGE_SIZE)).toBeNull();
  });

  it("points at the last row of a full page", () => {
    const page = Array.from({ length: 3 }, (_, i) =>
      row(`id-${i}`, `2026-08-2${i}T10:00:00Z`),
    );
    expect(nextCursor(page, 3)).toEqual({ createdAt: "2026-08-22T10:00:00Z", id: "id-2" });
  });

  it("advances past same-timestamp rows without skipping any", () => {
    // Two orders in the same second must not collide at a page boundary.
    const ts = "2026-08-20T10:00:00.000Z";
    const page = [row("id-9", ts), row("id-5", ts)];
    expect(nextCursor(page, 2)).toEqual({ createdAt: ts, id: "id-5" });
  });
});
