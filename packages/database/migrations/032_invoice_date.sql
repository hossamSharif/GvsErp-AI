-- Migration 032: User-selectable invoice date
--
-- Until now the invoice's effective date was implicit (created_at). Sales and
-- purchase entry now let the user pick the invoice date, so we need a dedicated
-- column that is independent of the row's creation timestamp. Backfills existing
-- rows from created_at so historical invoices keep their original date.
--
-- Strictly additive.
--
-- Dependencies: 004_invoices_schema.sql

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Backfill existing invoices from their creation date. The NOT NULL DEFAULT
-- above already stamped pre-existing rows with today's date, so realign them
-- to their true creation date.
UPDATE invoices SET invoice_date = created_at::date
  WHERE invoice_date <> created_at::date;
