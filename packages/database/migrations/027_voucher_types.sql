-- Migration 027: Tally voucher types
-- Phase 2 of the Tally-parity plan (originally deferred, now shipping).
--
-- Replaces the free-form journal_entries.source_type with a typed
-- voucher_type enum + per-type numbering (SAL-202605-0001, PAY-..., RCT-...
-- etc.) plus a narration column. journal_entries.entry_number stays as
-- the canonical column — the numbering function now stamps it with the
-- type-appropriate prefix instead of always 'JE-'.
--
-- Backfill: every existing posted entry gets a voucher_type derived from
-- its source_type. Entry numbers stay untouched (they remain JE-...) so
-- historical reports don't break.
--
-- Dependencies: 011_accounting_schema.sql

-- =============================================================================
-- voucher_type enum
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voucher_type') THEN
    CREATE TYPE voucher_type AS ENUM (
      'contra',         -- F4: cash <-> bank transfers
      'payment',        -- F5: outgoing payment to supplier
      'receipt',        -- F6: incoming payment from customer
      'journal',        -- F7: manual journal entry
      'sales',          -- F8: sales invoice JE
      'purchase',       -- F9: purchase invoice JE
      'credit_note',    -- Sale-return JE
      'debit_note',     -- Purchase-return JE
      'cogs',           -- COGS posting (Phase 5 auto-derived; not user-entered)
      'reversal'        -- Reversal of any of the above (deletion path)
    );
  END IF;
END $$;

-- =============================================================================
-- journal_entries columns
-- =============================================================================

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS voucher_type voucher_type,
  ADD COLUMN IF NOT EXISTS narration TEXT;

COMMENT ON COLUMN journal_entries.voucher_type IS
  'Phase 2: Tally voucher classification. Derived from source_type for auto-posted entries; chosen by the user for manual journal/contra entries.';
COMMENT ON COLUMN journal_entries.narration IS
  'Phase 2: Tally-style free-text narration shown on vouchers. Mirrors description but kept distinct so reports can format them differently.';

CREATE INDEX IF NOT EXISTS idx_journal_entries_voucher_type
  ON journal_entries(tenant_id, voucher_type)
  WHERE voucher_type IS NOT NULL;

-- =============================================================================
-- Backfill: derive voucher_type from source_type for existing rows.
-- Idempotent — only fills rows where voucher_type is currently NULL.
-- =============================================================================

UPDATE journal_entries
SET voucher_type = CASE source_type
    WHEN 'sale'              THEN 'sales'
    WHEN 'purchase'          THEN 'purchase'
    WHEN 'payment'           THEN 'payment'          -- May be receipt; refined below
    WHEN 'expense'           THEN 'payment'
    WHEN 'cogs'              THEN 'cogs'
    WHEN 'sale-reversal'     THEN 'reversal'
    WHEN 'purchase-reversal' THEN 'reversal'
    WHEN 'payment-reversal'  THEN 'reversal'
    WHEN 'expense-reversal'  THEN 'reversal'
    WHEN 'manual'            THEN 'journal'
    WHEN NULL                THEN 'journal'
    ELSE 'journal'
  END::voucher_type
WHERE voucher_type IS NULL;

-- Refine: payment entries with source_id pointing at a 'received' payment
-- become receipt vouchers.
UPDATE journal_entries je
SET voucher_type = 'receipt'
FROM payments p
WHERE je.source_type = 'payment'
  AND je.source_id   = p.id
  AND p.type         = 'received'
  AND je.voucher_type = 'payment';

-- =============================================================================
-- voucher_sequences — per-type monthly counter (mirrors payment_sequences
-- and avoids a SELECT MAX scan on every insert).
-- =============================================================================

CREATE TABLE IF NOT EXISTS voucher_sequences (
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  voucher_type voucher_type NOT NULL,
  year_month   TEXT NOT NULL,
  last_number  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, voucher_type, year_month)
);

ALTER TABLE voucher_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_voucher_sequences ON voucher_sequences
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY service_role_bypass_voucher_sequences ON voucher_sequences
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- generate_journal_entry_number() — updated to use voucher_type prefix
-- =============================================================================
-- Replaces the migration-011 version. Backward-compatible: rows with NULL
-- voucher_type still get the 'JE-' prefix for parity with old code.

CREATE OR REPLACE FUNCTION generate_journal_entry_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year_month TEXT;
  v_prefix     TEXT;
  v_next       INTEGER;
BEGIN
  IF NEW.entry_number IS NOT NULL AND NEW.entry_number != '' THEN
    RETURN NEW;
  END IF;

  v_year_month := TO_CHAR(NEW.entry_date, 'YYYYMM');
  v_prefix := CASE NEW.voucher_type
    WHEN 'contra'      THEN 'CON'
    WHEN 'payment'     THEN 'PAY'
    WHEN 'receipt'     THEN 'RCT'
    WHEN 'journal'     THEN 'JNL'
    WHEN 'sales'       THEN 'SAL'
    WHEN 'purchase'    THEN 'PUR'
    WHEN 'credit_note' THEN 'CN'
    WHEN 'debit_note'  THEN 'DN'
    WHEN 'cogs'        THEN 'COGS'
    WHEN 'reversal'    THEN 'REV'
    ELSE 'JE'
  END;

  -- Upsert into voucher_sequences and grab next number atomically.
  INSERT INTO voucher_sequences (tenant_id, voucher_type, year_month, last_number)
  VALUES (NEW.tenant_id, COALESCE(NEW.voucher_type, 'journal'::voucher_type), v_year_month, 1)
  ON CONFLICT (tenant_id, voucher_type, year_month)
  DO UPDATE SET last_number = voucher_sequences.last_number + 1
  RETURNING last_number INTO v_next;

  NEW.entry_number := v_prefix || '-' || v_year_month || '-' || LPAD(v_next::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_journal_entry_number() IS
  'Phase 2: generates a typed entry_number based on voucher_type prefix (SAL-, PAY-, RCT-, JNL-, etc.). Falls back to JE- when voucher_type is NULL.';
