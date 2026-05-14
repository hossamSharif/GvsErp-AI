-- Migration 021: Accounting defaults mapping + idempotency index
-- Purpose:
--   1. Add a per-tenant "role -> account" lookup so auto-posting flows (sale,
--      purchase, payment, expense, etc.) no longer carry an ad-hoc
--      `defaultAccounts` parameter through every caller. One source of truth.
--   2. Add a partial unique index on journal_entries so a retry of the same
--      source transaction (invoice, payment, expense) cannot produce a second
--      posted journal entry.
-- Dependencies: 011_accounting_schema.sql, 020_fix_accounting_rls_jwt.sql

-- =============================================================================
-- accounting_default_accounts
-- =============================================================================

CREATE TABLE IF NOT EXISTS accounting_default_accounts (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, role),
  CONSTRAINT accounting_default_accounts_role_check
    CHECK (role IN (
      'cash_in_hand',
      'accounts_receivable',
      'accounts_payable',
      'sales_revenue',
      'sales_tax_payable',
      'inventory_asset',
      'cogs',
      'discount_allowed',
      'discount_received',
      'salary_expense',
      'salary_payable',
      'general_expense',
      'service_purchase_expense'
    ))
);

CREATE INDEX IF NOT EXISTS idx_accounting_default_accounts_tenant
  ON accounting_default_accounts(tenant_id);

ALTER TABLE accounting_default_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_accounting_default_accounts
  ON accounting_default_accounts
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY service_role_bypass_accounting_default_accounts
  ON accounting_default_accounts
  FOR ALL
  TO service_role
  USING (true);

CREATE TRIGGER accounting_default_accounts_updated_at
  BEFORE UPDATE ON accounting_default_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE accounting_default_accounts IS
  'Maps semantic roles (e.g. cash_in_hand, accounts_receivable) to chart-of-accounts ledger ids per tenant. Used by auto-posting flows for sales, purchases, payments, expenses, payroll.';

-- =============================================================================
-- Idempotency: one posted journal entry per (source_type, source_id)
-- =============================================================================
-- A finalized invoice / payment / expense must never produce more than one
-- posted journal entry, even if the finalize handler retries. Service code
-- catches the resulting unique-violation and treats it as success.
--
-- Partial index so manual journal entries (source_type IS NULL) are not
-- constrained.

CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_entries_source_posted
  ON journal_entries (tenant_id, source_type, source_id)
  WHERE is_posted = true AND source_type IS NOT NULL AND source_id IS NOT NULL;

COMMENT ON INDEX uq_journal_entries_source_posted IS
  'Idempotency guard: a single source transaction can have at most one posted journal entry.';

-- =============================================================================
-- One-shot seed: populate role mappings for tenants that already activated
-- accounting BEFORE this migration. New activations seed via
-- AccountingService.importDefaultChartOfAccounts(). Idempotent — uses ON
-- CONFLICT DO NOTHING.
-- =============================================================================

INSERT INTO accounting_default_accounts (tenant_id, role, account_id)
SELECT a.tenant_id, m.role, a.id
FROM accounts a
JOIN (
  VALUES
    ('1110', 'cash_in_hand'),
    ('1120', 'accounts_receivable'),
    ('1130', 'inventory_asset'),
    ('2110', 'accounts_payable'),
    ('2120', 'sales_tax_payable'),
    ('4100', 'sales_revenue'),
    ('5100', 'cogs'),
    ('5200', 'general_expense'),
    ('5200', 'service_purchase_expense'),
    ('5210', 'salary_expense')
) AS m(code, role) ON a.code = m.code
ON CONFLICT (tenant_id, role) DO NOTHING;
