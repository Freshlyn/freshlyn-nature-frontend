-- Seller identity for downloadable receipts.
--
-- No schema change: app_settings is key/value jsonb precisely so adding a
-- setting is an INSERT rather than a migration on the table itself.
--
-- WHY THIS ROW EXISTS SEPARATELY FROM `contact`
--
-- `contact` answers "how does a customer reach support". This answers "who
-- sold the goods". They overlap today because the brand and the entity are
-- the same name, and they stop overlapping the moment the business registers
-- under a different legal name -- which is exactly the fact a receipt has to
-- state correctly.
--
-- ============================================================================
-- PLACEHOLDER VALUES -- REPLACE BEFORE CUSTOMERS DOWNLOAD A RECEIPT
-- ============================================================================
-- legalName, addressLines and phoneDisplay below are carried over from the
-- `contact` row, whose phone number is documented there as a non-working
-- placeholder. A receipt naming the wrong entity, or listing an address the
-- business does not trade from, is worse than no receipt at all.
--
-- Set the real values from the Supabase dashboard (no deploy needed):
--   legalName    -- the entity as registered, e.g. "Freshlyn Nature Pvt Ltd"
--   addressLines -- the principal place of business, one array element per line
--   phoneDisplay -- a line that is actually answered
--
-- ============================================================================
-- gstin: EMPTY ON PURPOSE
-- ============================================================================
-- While `gstin` is "", the app issues a BILL OF SUPPLY headed "Receipt",
-- carrying the line "Not a tax invoice". That is the correct document for a
-- seller without a GST registration: it needs no GSTIN, no HSN/SAC codes and
-- no gapless number series, and it cannot be used to claim input credit.
--
-- Filling in gstin RELABELS the document as a Tax Invoice. Do not do that on
-- the strength of this comment alone. A tax invoice under CGST Rule 46 also
-- requires:
--   * an HSN/SAC code per line -- products carry no such column today;
--   * the taxable value and the CGST/SGST split per line;
--   * a consecutive, GAPLESS invoice number series per financial year.
-- src/lib/receipt.ts derives its reference from the order id and month, which
-- is deliberately NOT a compliant series. So setting gstin is the trigger to
-- build the rest, not the completion of it. Talk to your CA first.
--
-- fssai: the licence number, printed when non-empty. Food businesses are
-- generally required to display it on invoices/bills once licensed.
insert into public.app_settings (key, value, description) values
  (
    'seller',
    '{"legalName":"Freshlyn Nature","tradeName":"Freshlyn Nature","addressLines":["Kolkata","West Bengal, India"],"email":"info@freshlynnature.com","phoneDisplay":"+91 98765 43210","gstin":"","fssai":""}'::jsonb,
    'Seller of record printed on downloaded receipts. PLACEHOLDER legalName/addressLines/phoneDisplay -- replace with the registered business details before customers download receipts. gstin is EMPTY BY DESIGN: while empty the document is a Bill of Supply ("Receipt", marked "Not a tax invoice"), which is lawful without a GST registration. Setting gstin relabels it a Tax Invoice, which ALSO legally requires per-line HSN/SAC codes, a CGST/SGST split and a gapless sequential number series -- none of which exist yet. Do not set it without implementing those. fssai is printed when non-empty.'
  )
on conflict (key) do nothing;
