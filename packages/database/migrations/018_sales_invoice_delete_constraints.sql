-- Migration: 018_sales_invoice_delete_constraints
-- Description: Tighten FK constraints so the database refuses to silently
-- orphan or chain-cascade when an invoice is hard-deleted. The application
-- service layer (apps/api/src/services/invoice.service.ts) already blocks
-- deletes when payments or child returns reference the invoice; these
-- constraints make the database the source of truth.

ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey;

ALTER TABLE payments
    ADD CONSTRAINT payments_invoice_id_fkey
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT;

ALTER TABLE invoices
    DROP CONSTRAINT IF EXISTS invoices_returned_from_id_fkey;

ALTER TABLE invoices
    ADD CONSTRAINT invoices_returned_from_id_fkey
    FOREIGN KEY (returned_from_id) REFERENCES invoices(id) ON DELETE RESTRICT;
