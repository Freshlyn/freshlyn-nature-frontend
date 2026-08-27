/**
 * Turns a stored order into the document a customer downloads.
 *
 * Pure functions only -- no React, no Supabase. The page renders what this
 * returns, which is what makes the money arithmetic and the legal framing
 * testable without a browser.
 *
 * ## Why this is a Receipt and not an Invoice
 *
 * Under Indian GST a "tax invoice" is a regulated document: it must carry the
 * seller's GSTIN, an HSN/SAC code per line, the taxable value and the
 * CGST/SGST split, and its number must come from a gapless sequential series
 * (CGST Rule 46). A seller without a GSTIN issues a Bill of Supply instead,
 * which has none of those requirements.
 *
 * So while `seller.gstin` is empty this emits a Bill of Supply: a receipt for
 * money actually received, which is always lawful to issue, needs no
 * registration, and is what a customer wants for reimbursement. It states in
 * as many words that it is not a tax invoice, so it can never be mistaken for
 * one or used to claim input credit.
 *
 * Setting a GSTIN relabels the document -- but read the caveat on
 * SellerIdentity.gstin first: the number series here is not a compliant one.
 */
import { format } from "date-fns";
import type { SellerIdentity } from "@/lib/seller-content";

/** Payment states in which money has demonstrably reached the business. */
const SETTLED_PAYMENT_STATUSES = ["paid", "collected"] as const;

/**
 * The order fields a receipt reads. A structural subset of OrderWithItems
 * rather than an import of it: the receipt depends on the handful of columns
 * it prints, so a change elsewhere in the order shape cannot silently alter
 * the document.
 */
export interface ReceiptOrder {
  id: string;
  delivery_address: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_status: string;
  payment_method: string;
  created_at: string;
  items: ReceiptOrderItem[];
}

export interface ReceiptOrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  delivery_type: "one_time" | "subscription";
  subscription_duration_days?: number;
  subscription_frequency?: "daily" | "alternate";
  discount_percent?: number;
  product?: { id: string; name: string; image_url: string | null };
  variant?: { id: string; name: string };
}

export interface ReceiptLine {
  id: string;
  /** Product and variant, e.g. "Cow Milk (1L)". */
  description: string;
  /** How the amount was arrived at, e.g. "2 x ₹50.00". */
  detail: string;
  amount: number;
}

export interface Receipt {
  title: string;
  subtitle: string;
  isTaxInvoice: boolean;
  /** Present only when the seller is registered. Never a zero placeholder. */
  gstin: string | null;
  /** The disclaimer shown on a Bill of Supply; null on a tax invoice. */
  taxNote: string | null;
  number: string;
  orderId: string;
  issuedOn: string;
  seller: SellerIdentity;
  deliveryAddress: string;
  paymentLabel: string;
  lines: ReceiptLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

/**
 * Whether this order may produce a receipt at all.
 *
 * A receipt attests that money was received, so an order still awaiting
 * payment does not get one -- issuing it would be the single genuinely
 * misleading thing this feature could do. `refunded` is excluded for the
 * mirror-image reason: the money went back.
 */
export function isReceiptAvailable(order: Pick<ReceiptOrder, "payment_status">): boolean {
  return (SETTLED_PAYMENT_STATUSES as readonly string[]).includes(order.payment_status);
}

/**
 * A human-readable reference, e.g. "FN-2608-7F3C1E".
 *
 * Derived from the order rather than allocated from a counter, and that is
 * deliberate: a tax invoice needs a gapless sequential series, and a
 * half-built one would be worse than none -- it would be a broken series to
 * inherit the day registration completes. This is explicitly a *reference*,
 * labelled "Receipt No.", not an invoice number. The full order id is printed
 * alongside it so support can always resolve it back to the row.
 */
export function receiptNumber(order: Pick<ReceiptOrder, "id" | "created_at">): string {
  const month = format(new Date(order.created_at), "yyMM");
  // Hyphens stripped first so a short leading group cannot pull a separator
  // into the reference.
  const suffix = order.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `FN-${month}-${suffix}`;
}

function formatMoney(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  alternate: "Alternate days",
};

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
  razorpay: "Online (Razorpay)",
};

/**
 * Price one line.
 *
 * The subscription branch mirrors OrderDetail's computedSubtotal exactly,
 * including its guard for a missing duration. The two must agree: a receipt
 * whose lines sum differently from the order page is a support ticket at
 * best.
 */
function lineAmount(item: ReceiptOrderItem): number {
  if (item.delivery_type === "subscription" && item.subscription_duration_days) {
    return (
      item.unit_price * item.subscription_duration_days * (1 - (item.discount_percent || 0) / 100)
    );
  }
  return item.unit_price * item.quantity;
}

function lineDetail(item: ReceiptOrderItem): string {
  if (item.delivery_type === "subscription" && item.subscription_duration_days) {
    const frequency = FREQUENCY_LABELS[item.subscription_frequency ?? ""] ?? "Scheduled";
    const base = `${frequency} x ${item.subscription_duration_days} deliveries`;
    // The whole plan on one line, as charged upfront -- not one row per
    // delivery. The schedule lives on the order page; the receipt records the
    // transaction.
    return item.discount_percent ? `${base} · ${item.discount_percent}% off` : base;
  }
  return `${item.quantity} x ${formatMoney(item.unit_price)}`;
}

function lineDescription(item: ReceiptOrderItem): string {
  // A product deleted since the order was placed still has to appear, or the
  // lines stop summing to the total the customer paid.
  const name = item.product?.name ?? "Item";
  return item.variant?.name ? `${name} (${item.variant.name})` : name;
}

export function buildReceipt(order: ReceiptOrder, seller: SellerIdentity): Receipt {
  // Trimmed, because an operator clearing the dashboard field leaves
  // whitespace behind -- and whitespace must not promote a bill of supply
  // into a tax invoice headed by a blank registration number.
  const gstin = seller.gstin.trim();
  const isTaxInvoice = gstin.length > 0;

  return {
    title: isTaxInvoice ? "Tax Invoice" : "Receipt",
    subtitle: isTaxInvoice ? "Tax Invoice" : "Bill of Supply",
    isTaxInvoice,
    gstin: isTaxInvoice ? gstin : null,
    taxNote: isTaxInvoice
      ? null
      : "Not a tax invoice. GST registration in progress; no tax has been charged on this sale.",
    number: receiptNumber(order),
    orderId: order.id,
    issuedOn: format(new Date(order.created_at), "d MMMM yyyy 'at' h:mm a"),
    seller,
    deliveryAddress: order.delivery_address,
    paymentLabel: PAYMENT_LABELS[order.payment_method] ?? order.payment_method,
    lines: order.items.map((item) => ({
      id: item.id,
      description: lineDescription(item),
      detail: lineDetail(item),
      amount: lineAmount(item),
    })),
    // The stored figures verbatim. These are what was actually charged;
    // recomputing them here would let the receipt drift from the payment.
    subtotal: order.subtotal,
    deliveryFee: order.delivery_fee,
    total: order.total,
  };
}

export { formatMoney };
