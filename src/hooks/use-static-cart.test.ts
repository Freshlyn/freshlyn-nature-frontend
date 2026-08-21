import { describe, expect, it } from "vitest";
import { deriveCartLoading } from "./use-static-cart";

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
