-- Migration 028: Fix validate_journal_entry_balance() referencing wrong column
--
-- Context
-- -------
-- Migration 011_accounting_schema.sql defined validate_journal_entry_balance()
-- and attached it to a trigger on `journal_entries` (BEFORE UPDATE OF is_posted).
-- The function body queried `WHERE journal_entry_id = NEW.journal_entry_id`,
-- but NEW in a journal_entries trigger is a journal_entries row — it has no
-- `journal_entry_id` column, only `id`. The trigger raised
--   "record 'new' has no field 'journal_entry_id'"
-- on every UPDATE that flipped is_posted=true, blocking ALL journal posting
-- (manual and auto from sales/purchase/payment/expense flows).
--
-- This was discovered during the T2 phase of the accounting test pass
-- (docs/tally-parity-test-plan.md). Since no journal entries had ever been
-- posted on the dev tenant prior to this work, the bug was latent.
--
-- Fix
-- ---
-- Replace the function definition so it uses NEW.id to locate the entry's
-- lines. The trigger registration in 011 (validate_journal_balance_before_post)
-- stays as-is — only the function body changes.

CREATE OR REPLACE FUNCTION validate_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debits DECIMAL(15,2);
  total_credits DECIMAL(15,2);
BEGIN
  -- The trigger is registered on journal_entries, so NEW is a journal_entries
  -- row. Use NEW.id to find its lines (not NEW.journal_entry_id which does
  -- not exist on that table).
  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO total_debits, total_credits
  FROM journal_lines
  WHERE journal_entry_id = NEW.id;

  IF total_debits != total_credits THEN
    RAISE EXCEPTION 'Journal entry must be balanced: debits (%) != credits (%)', total_debits, total_credits;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
