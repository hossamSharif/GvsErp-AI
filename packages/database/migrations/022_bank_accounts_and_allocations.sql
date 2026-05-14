-- Migration 022: Bank accounts + bill-wise payment allocations
-- Phase 3 of the Tally-parity plan.
--
-- Replaces the free-text `payments.payment_method` column with a first-class
-- `bank_accounts` table where each bank is bound 1:1 to a ledger account in
-- the chart of accounts. Adds `payment_allocations` so a single payment can
-- clear specific invoices (Tally "bill-wise details"), supporting partial
-- payments and advances.
--
-- Dependencies: 004_invoices_schema.sql, 007_parties_schema.sql,
--               011_accounting_schema.sql, 015_fix_payments_rls_jwt.sql,
--               021_accounting_defaults_and_idempotency.sql

-- =============================================================================
-- bank_accounts
-- =============================================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_number TEXT,
  bank_name TEXT,
  -- Each bank account is bound 1:1 to a ledger in the chart of accounts.
  -- ON DELETE RESTRICT prevents orphaning the bank if the ledger is removed.
  ledger_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT bank_accounts_name_check CHECK (length(name) >= 1 AND length(name) <= 255),
  CONSTRAINT bank_accounts_currency_format CHECK (char_length(currency) = 3),
  CONSTRAINT bank_accounts_tenant_ledger_unique UNIQUE (tenant_id, ledger_account_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant ON bank_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(tenant_id, is_active) WHERE is_active = true;

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_bank_accounts ON bank_accounts
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY service_role_bypass_bank_accounts ON bank_accounts
  FOR ALL
  TO service_role
  USING (true);

CREATE TRIGGER bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE bank_accounts IS
  'First-class bank/cash account. Each row owns a ledger in the chart of accounts (1:1 via ledger_account_id); journal entries for payments target that ledger.';

-- =============================================================================
-- payments.bank_account_id (nullable — NULL = cash tender, no specific bank)
-- =============================================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_bank_account
  ON payments(bank_account_id)
  WHERE bank_account_id IS NOT NULL;

COMMENT ON COLUMN payments.bank_account_id IS
  'Bank/cash account the payment went through. NULL means generic cash-in-hand (fallback to accounting_default_accounts.cash_in_hand for posting).';

-- =============================================================================
-- payment_allocations — bill-wise details
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  -- Restrict invoice deletion if it still has allocated payments; the invoice
  -- delete path must explicitly unwind allocations first.
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount DECIMAL(15,2) NOT NULL,
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT payment_allocations_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_tenant ON payment_allocations(tenant_id);

ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_payment_allocations ON payment_allocations
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY service_role_bypass_payment_allocations ON payment_allocations
  FOR ALL
  TO service_role
  USING (true);

COMMENT ON TABLE payment_allocations IS
  'Maps payments to the specific invoices they clear. SUM(amount) per payment must not exceed payments.amount (enforced by trigger). Unallocated balance = advance/on-account.';

-- =============================================================================
-- Sum-check trigger: SUM(payment_allocations.amount) <= payments.amount
-- =============================================================================

CREATE OR REPLACE FUNCTION validate_payment_allocation_sum()
RETURNS TRIGGER AS $$
DECLARE
  pid UUID;
  payment_amount DECIMAL(15,2);
  total_allocated DECIMAL(15,2);
BEGIN
  pid := COALESCE(NEW.payment_id, OLD.payment_id);

  SELECT amount INTO payment_amount FROM payments WHERE id = pid;

  -- Payment row may already have been deleted (CASCADE) — that's fine, allow.
  IF payment_amount IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_allocated
  FROM payment_allocations
  WHERE payment_id = pid;

  -- Use a 0.01 tolerance for rounding noise.
  IF total_allocated > payment_amount + 0.01 THEN
    RAISE EXCEPTION 'Payment allocations (%) exceed payment amount (%) for payment %',
      total_allocated, payment_amount, pid;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_payment_allocation_sum_after
  AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_allocation_sum();

-- =============================================================================
-- Backfill: copy existing payments.invoice_id 1:1 mappings into the new table.
-- Idempotent — guarded by NOT EXISTS check so re-running is safe.
-- =============================================================================

INSERT INTO payment_allocations (tenant_id, payment_id, invoice_id, amount)
SELECT p.tenant_id, p.id, p.invoice_id, p.amount
FROM payments p
WHERE p.invoice_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payment_allocations a
    WHERE a.payment_id = p.id AND a.invoice_id = p.invoice_id
  );
