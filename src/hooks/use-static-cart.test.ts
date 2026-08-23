import { describe, expect, it } from "vitest";
import { applyQuantityCap, deriveCartLoading, resolveQuantityCap } from "./use-static-cart";

const settled = {
  storedItemCount: 1,
  productsLoading: false,
  variantsFetched: true,
  durationsFetched: true,
};

describe("deriveCartLoading", () => {
  it("is false for an empty cart so the empty state shows immediately", () => {
    // The detail queries are `enabled`-gated off here, so their isFetched never
    // flips -- an empty cart must not depend on them.
    expect(
      deriveCartLoading({
        storedItemCount: 0,
        productsLoading: false,
        variantsFetched: false,
        durationsFetched: false,
      }),
    ).toBe(false);
  });

  it("is true on first render, before any detail query settles", () => {
    expect(
      deriveCartLoading({
        storedItemCount: 2,
        productsLoading: true,
        variantsFetched: false,
        durationsFetched: false,
      }),
    ).toBe(true);
  });

  it("stays true while any single dependency is outstanding", () => {
    expect(deriveCartLoading({ ...settled, productsLoading: true })).toBe(true);
    expect(deriveCartLoading({ ...settled, variantsFetched: false })).toBe(true);
    expect(deriveCartLoading({ ...settled, durationsFetched: false })).toBe(true);
  });

  it("is false once every dependency has settled", () => {
    expect(deriveCartLoading(settled)).toBe(false);
  });

  it("resolves even when the fetches came back with no usable rows", () => {
    // A cart holding a since-unavailable product: the queries settle but the
    // item never resolves. This must fall through to the empty state rather
    // than showing a skeleton forever.
    expect(deriveCartLoading({ ...settled, storedItemCount: 3 })).toBe(false);
  });
});

describe("resolveQuantityCap", () => {
  it("uses the variant's own per-order limit", () => {
    // Milk in production carries a deliberately-lowered limit of 10 while
    // holding far more stock; the limit is what must bind.
    expect(resolveQuantityCap({ max_quantity_per_order: 10, stock_quantity: 101 })).toBe(10);
  });

  it("falls back to 100 when the limit is missing from the payload", () => {
    // The column is NOT NULL, so this only covers a client-side hole: a cached
    // or partially-mapped variant that never carried the field.
    expect(resolveQuantityCap({ stock_quantity: 500 })).toBe(100);
    expect(
      resolveQuantityCap({ max_quantity_per_order: undefined, stock_quantity: 500 }),
    ).toBe(100);
  });

  it("clamps to stock when stock is the tighter of the two", () => {
    expect(resolveQuantityCap({ max_quantity_per_order: 100, stock_quantity: 3 })).toBe(3);
  });

  it("never returns a negative cap for an out-of-stock variant", () => {
    expect(resolveQuantityCap({ max_quantity_per_order: 10, stock_quantity: 0 })).toBe(0);
    expect(resolveQuantityCap({ max_quantity_per_order: 10, stock_quantity: -5 })).toBe(0);
  });

  it("treats absent stock as unconstrained rather than as zero", () => {
    // A missing stock field must not silently make every item unaddable.
    expect(resolveQuantityCap({ max_quantity_per_order: 10 })).toBe(10);
  });
});

describe("applyQuantityCap", () => {
  it("grants the full request when it fits under the cap", () => {
    expect(applyQuantityCap(3, 10)).toEqual({ granted: 3, limitReached: false });
  });

  it("grants exactly the cap and reports the limit when the request overshoots", () => {
    expect(applyQuantityCap(15, 10)).toEqual({ granted: 10, limitReached: true });
  });

  it("reports the limit when landing exactly on the cap from below", () => {
    // Blinkit toasts only when a tap is REFUSED, not when it lands on the
    // ceiling -- reaching 10 of 10 is a successful add.
    expect(applyQuantityCap(10, 10)).toEqual({ granted: 10, limitReached: false });
  });

  it("reports the limit when already at the cap and asking for more", () => {
    // The repeat-tap case: quantity cannot move, so the tap was refused.
    expect(applyQuantityCap(11, 10)).toEqual({ granted: 10, limitReached: true });
  });

  it("never grants a negative quantity", () => {
    expect(applyQuantityCap(5, 0)).toEqual({ granted: 0, limitReached: true });
  });

  it("treats an unknown cap as unconstrained", () => {
    expect(applyQuantityCap(999, Number.POSITIVE_INFINITY)).toEqual({
      granted: 999,
      limitReached: false,
    });
  });
});
