import { describe, it, expect } from "vitest";
import { isVariantOutOfStock, isProductOutOfStock } from "./use-products";

describe("isVariantOutOfStock", () => {
  it("treats zero stock as sold out", () => {
    expect(isVariantOutOfStock({ stock_quantity: 0 })).toBe(true);
  });

  it("treats negative stock as sold out", () => {
    // Nothing constrains the column to >= 0, and concurrent confirms can drive
    // it below zero, so this must not read as "available".
    expect(isVariantOutOfStock({ stock_quantity: -3 })).toBe(true);
  });

  it("treats positive stock as available", () => {
    expect(isVariantOutOfStock({ stock_quantity: 1 })).toBe(false);
    expect(isVariantOutOfStock({ stock_quantity: 50 })).toBe(false);
  });

  it("treats a missing stock field as available, not sold out", () => {
    // The column is NOT NULL, so absence means a client-side hole. Stamping it
    // would hide a buyable product; the server's 409 is the real backstop.
    expect(isVariantOutOfStock({})).toBe(false);
    expect(isVariantOutOfStock({ stock_quantity: undefined })).toBe(false);
  });
});

describe("isProductOutOfStock", () => {
  it("is sold out only when every variant is sold out", () => {
    expect(
      isProductOutOfStock([{ stock_quantity: 0 }, { stock_quantity: 0 }, { stock_quantity: 0 }]),
    ).toBe(true);
  });

  it("is available when any single variant has stock", () => {
    // The card must stay addable here -- the sold-out size is revealed only
    // inside the detail modal.
    expect(isProductOutOfStock([{ stock_quantity: 0 }, { stock_quantity: 42 }])).toBe(false);
  });

  it("is available when all variants have stock", () => {
    expect(isProductOutOfStock([{ stock_quantity: 10 }, { stock_quantity: 5 }])).toBe(false);
  });

  it("is NOT sold out for an empty variant list", () => {
    // An empty list means variants failed to load, not that the product is
    // gone. every() on [] returns true, so this case needs the explicit guard.
    expect(isProductOutOfStock([])).toBe(false);
  });

  it("handles a single sold-out variant", () => {
    expect(isProductOutOfStock([{ stock_quantity: 0 }])).toBe(true);
  });

  it("does not stamp a product whose variants lack stock data", () => {
    expect(isProductOutOfStock([{}, {}])).toBe(false);
  });
});
