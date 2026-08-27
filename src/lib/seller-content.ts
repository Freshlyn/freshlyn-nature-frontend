/**
 * Who the receipt says sold the goods.
 *
 * Separate from LegalContact even though the two overlap: `contact` answers
 * "how do I reach support", this answers "who is the seller of record". They
 * diverge the moment the registered entity name differs from the brand name,
 * which is exactly the case a receipt has to get right.
 *
 * PLACEHOLDER VALUES BELOW -- see the note on `legalName`. These are the
 * fallbacks that render if app_settings is unreachable; the operator owns the
 * real values from the Supabase dashboard.
 */

export interface SellerIdentity {
  /** The entity that made the sale, as registered. */
  legalName: string;
  /** Customer-facing brand, printed above the legal name when they differ. */
  tradeName: string;
  /** Place of business, one line per element. */
  addressLines: string[];
  email: string;
  phoneDisplay: string;
  /**
   * GST registration number, or "" while unregistered.
   *
   * This single field decides whether the document is a Bill of Supply or a
   * Tax Invoice. It is empty by design: issuing a document headed "Tax
   * Invoice" without a real GSTIN is a compliance problem, not a cosmetic
   * one. Paste the number in from the dashboard the day registration
   * completes and every receipt relabels itself -- no deploy.
   *
   * NOTE the numbering caveat before you do: a tax invoice must carry a
   * gapless sequential number series (CGST Rule 46), which receiptNumber()
   * deliberately does NOT produce. Switching this on is the trigger to
   * implement a real series, not the end of the work.
   */
  gstin: string;
  /** FSSAI licence, printed when present. Required on food invoices. */
  fssai: string;
}

/**
 * PLACEHOLDER IDENTITY -- NOT THE REGISTERED BUSINESS DETAILS.
 *
 * Carried over from DEFAULT_CONTACT, which flags its phone number as a
 * non-working placeholder. Before customers see a receipt, replace legalName,
 * addressLines and phoneDisplay with the real registered values via the
 * `seller` row in app_settings. A receipt naming the wrong entity is worse
 * than no receipt.
 */
export const DEFAULT_SELLER: SellerIdentity = {
  legalName: "Freshlyn Nature",
  tradeName: "Freshlyn Nature",
  addressLines: ["Kolkata", "West Bengal, India"],
  email: "info@freshlynnature.com",
  phoneDisplay: "+91 98765 43210",
  gstin: "",
  fssai: "",
};
