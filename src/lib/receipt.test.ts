import { describe, it, expect } from "vitest";
import { buildReceipt, isReceiptAvailable, receiptNumber, type ReceiptOrder } from "@/lib/receipt";
import { DEFAULT_SELLER } from "@/lib/seller-content";

/**
 * Fixtures mirror the shape useOrder returns, trimmed to the fields the
 * receipt reads. Prices are chosen so a wrong formula produces a visibly
 * wrong number rather than a near-miss.
 */
function order(overrides: Partial<ReceiptOrder> = {}): ReceiptOrder {
  return {
    id: "7f3c1e94-2b6d-4a51-9c08-ab12cd34ef56",
    delivery_address: "12 Park Street, Kolkata, West Bengal 700016",
    subtotal: 100,
    delivery_fee: 25,
    total: 125,
    payment_status: "paid",
    payment_method: "razorpay",
    created_at: "2026-08-14T06:30:00.000Z",
    items: [],
    ...overrides,
  };
}

function oneTimeItem(overrides = {}) {
  return {
    id: "item-1",
    quantity: 2,
    unit_price: 50,
    delivery_type: "one_time" as const,
    product: { id: "p1", name: "Cow Milk", image_url: null },
    variant: { id: "v1", name: "1L" },
    ...overrides,
  };
}

function subscriptionItem(overrides = {}) {
  return {
    id: "item-2",
    quantity: 1,
    unit_price: 60,
    delivery_type: "subscription" as const,
    subscription_duration_days: 30,
    subscription_frequency: "daily" as const,
    discount_percent: 10,
    product: { id: "p2", name: "Buffalo Milk", image_url: null },
    variant: { id: "v2", name: "500ml" },
    ...overrides,
  };
}

describe("isReceiptAvailable", () => {
  // The gate that keeps the app from asserting money was received before it
  // was. A receipt for an unpaid COD order is the one genuinely misleading
  // document this feature could produce.
  it("allows a razorpay-paid order", () => {
    expect(isReceiptAvailable(order({ payment_status: "paid" }))).toBe(true);
  });

  it("allows a COD order once cash is collected", () => {
    expect(isReceiptAvailable(order({ payment_status: "collected", payment_method: "cod" }))).toBe(
      true,
    );
  });

  it("refuses an order awaiting payment", () => {
    expect(isReceiptAvailable(order({ payment_status: "pending" }))).toBe(false);
  });

  it("refuses a failed payment", () => {
    expect(isReceiptAvailable(order({ payment_status: "failed" }))).toBe(false);
  });

  it("refuses a refunded order", () => {
    // The money went back. A receipt saying it was received would be false.
    expect(isReceiptAvailable(order({ payment_status: "refunded" }))).toBe(false);
  });
});

describe("receiptNumber", () => {
  it("derives FN-YYMM-<6 hex> from the order date and id", () => {
    expect(receiptNumber(order())).toBe("FN-2608-7F3C1E");
  });

  it("is stable across calls for the same order", () => {
    const o = order();
    expect(receiptNumber(o)).toBe(receiptNumber(o));
  });

  it("distinguishes orders placed in the same month", () => {
    const a = receiptNumber(order({ id: "aaaaaaaa-1111-2222-3333-444444444444" }));
    const b = receiptNumber(order({ id: "bbbbbbbb-1111-2222-3333-444444444444" }));
    expect(a).not.toBe(b);
  });

  it("tracks the month the order was placed, not today", () => {
    expect(receiptNumber(order({ created_at: "2027-01-02T00:00:00.000Z" }))).toBe("FN-2701-7F3C1E");
  });

  it("ignores hyphens when taking the id prefix", () => {
    // A short first group must not pull a hyphen into the reference.
    expect(receiptNumber(order({ id: "ab-cdef01-2222", created_at: "2026-08-14T06:30:00Z" }))).toBe(
      "FN-2608-ABCDEF",
    );
  });
});

describe("buildReceipt line items", () => {
  it("prices a one-time item as unit_price x quantity", () => {
    const receipt = buildReceipt(order({ items: [oneTimeItem()] }), DEFAULT_SELLER);
    expect(receipt.lines).toHaveLength(1);
    expect(receipt.lines[0].description).toBe("Cow Milk (1L)");
    expect(receipt.lines[0].detail).toBe("2 x ₹50.00");
    expect(receipt.lines[0].amount).toBe(100);
  });

  it("collapses a subscription to one line with the discount applied", () => {
    // 60 x 30 deliveries less 10% = 1620. The formula must match
    // OrderDetail's, or the receipt total disagrees with the order page.
    const receipt = buildReceipt(order({ items: [subscriptionItem()] }), DEFAULT_SELLER);
    expect(receipt.lines).toHaveLength(1);
    expect(receipt.lines[0].description).toBe("Buffalo Milk (500ml)");
    expect(receipt.lines[0].detail).toBe("Daily x 30 deliveries · 10% off");
    expect(receipt.lines[0].amount).toBe(1620);
  });

  it("omits the discount clause when there is none", () => {
    const receipt = buildReceipt(
      order({ items: [subscriptionItem({ discount_percent: 0 })] }),
      DEFAULT_SELLER,
    );
    expect(receipt.lines[0].detail).toBe("Daily x 30 deliveries");
    expect(receipt.lines[0].amount).toBe(1800);
  });

  it("labels an alternate-day plan", () => {
    const receipt = buildReceipt(
      order({
        items: [subscriptionItem({ subscription_frequency: "alternate", discount_percent: 0 })],
      }),
      DEFAULT_SELLER,
    );
    expect(receipt.lines[0].detail).toBe("Alternate days x 30 deliveries");
  });

  it("falls back to quantity pricing when a subscription has no duration", () => {
    // Mirrors OrderDetail's guard: a malformed row must not price as NaN.
    const receipt = buildReceipt(
      order({ items: [subscriptionItem({ subscription_duration_days: undefined })] }),
      DEFAULT_SELLER,
    );
    expect(receipt.lines[0].amount).toBe(60);
  });

  it("keeps a deleted product's line rather than dropping it", () => {
    // Dropping the line would make the lines sum to less than the total the
    // customer actually paid -- a receipt that does not add up.
    const receipt = buildReceipt(
      order({ items: [oneTimeItem({ product: undefined, variant: undefined })] }),
      DEFAULT_SELLER,
    );
    expect(receipt.lines).toHaveLength(1);
    expect(receipt.lines[0].description).toBe("Item");
    expect(receipt.lines[0].amount).toBe(100);
  });
});

describe("buildReceipt totals", () => {
  it("reports the stored total verbatim", () => {
    // The stored total is what was charged. Recomputing it here risks the
    // receipt disagreeing with the payment.
    const receipt = buildReceipt(
      order({ items: [oneTimeItem()], subtotal: 100, delivery_fee: 25, total: 125 }),
      DEFAULT_SELLER,
    );
    expect(receipt.subtotal).toBe(100);
    expect(receipt.deliveryFee).toBe(25);
    expect(receipt.total).toBe(125);
  });

  it("marks a zero delivery fee so free delivery is visible", () => {
    const receipt = buildReceipt(
      order({ items: [oneTimeItem()], delivery_fee: 0, total: 100 }),
      DEFAULT_SELLER,
    );
    expect(receipt.deliveryFee).toBe(0);
  });
});

describe("buildReceipt document framing", () => {
  it("is a bill of supply, never a tax invoice, without a GSTIN", () => {
    const receipt = buildReceipt(order(), DEFAULT_SELLER);
    expect(receipt.title).toBe("Receipt");
    expect(receipt.subtitle).toBe("Bill of Supply");
    expect(receipt.isTaxInvoice).toBe(false);
    expect(receipt.taxNote).toContain("Not a tax invoice");
  });

  it("does not emit a tax line when the seller is unregistered", () => {
    // A "GST ₹0.00" row would imply a registration that does not exist.
    const receipt = buildReceipt(order(), DEFAULT_SELLER);
    expect(receipt.gstin).toBeNull();
  });

  it("becomes a tax invoice once a GSTIN is configured", () => {
    // The upgrade path: an operator pastes the number into app_settings and
    // the document relabels itself, with no code change.
    const receipt = buildReceipt(order(), { ...DEFAULT_SELLER, gstin: "19AAAAA0000A1Z5" });
    expect(receipt.title).toBe("Tax Invoice");
    expect(receipt.isTaxInvoice).toBe(true);
    expect(receipt.gstin).toBe("19AAAAA0000A1Z5");
    expect(receipt.taxNote).toBeNull();
  });

  it("treats a blank GSTIN as unregistered", () => {
    // An operator clearing the dashboard field must not produce a tax invoice
    // headed with an empty registration number.
    const receipt = buildReceipt(order(), { ...DEFAULT_SELLER, gstin: "   " });
    expect(receipt.isTaxInvoice).toBe(false);
    expect(receipt.gstin).toBeNull();
  });

  it("carries the payment method and the buyer's address", () => {
    const receipt = buildReceipt(
      order({ payment_method: "cod", payment_status: "collected" }),
      DEFAULT_SELLER,
    );
    expect(receipt.paymentLabel).toBe("Cash on Delivery");
    expect(receipt.deliveryAddress).toBe("12 Park Street, Kolkata, West Bengal 700016");
  });

  it("labels an online payment", () => {
    const receipt = buildReceipt(order({ payment_method: "razorpay" }), DEFAULT_SELLER);
    expect(receipt.paymentLabel).toBe("Online (Razorpay)");
  });
});
