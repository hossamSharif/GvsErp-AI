-- Migration 023: Party-as-ledger + group flag on chart of accounts.
-- Phase 4 of the Tally-parity plan.
--
-- Core Tally insight: every customer/supplier is its own ledger under
-- Sundry Debtors / Sundry Creditors. Trial balance and balance sheet then
-- show one line per party instead of a single AR / AP total.
--
-- Dependencies: 007_parties_schema.sql, 011_accounting_schema.sql,
--               021_accounting_defaults_and_idempotency.sql

-- =============================================================================
-- accounts: is_group flag (Tally semantics — only leaves can be posted to)
-- =============================================================================

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS nature TEXT;

COMMENT ON COLUMN accounts.is_group IS
  'When true, this account is a group/header that cannot be posted to directly. Tally-style: only leaf accounts accept journal lines.';
COMMENT ON COLUMN accounts.nature IS
  'Optional Tally classification text — assets/liabilities/income/expenses or named group (Sundry Debtors, Bank Accounts, etc.).';

-- Any existing parent account becomes a group. Idempotent — only flips
-- false to true.
UPDATE accounts a
SET is_group = true
WHERE is_group = false
  AND EXISTS (
    SELECT 1 FROM accounts c WHERE c.parent_id = a.id
  );

-- =============================================================================
-- parties.ledger_account_id — 1:1 link to a chart-of-accounts ledger
-- =============================================================================

ALTER TABLE parties
  ADD COLUMN IF NOT EXISTS ledger_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parties_ledger_account
  ON parties(ledger_account_id)
  WHERE ledger_account_id IS NOT NULL;

COMMENT ON COLUMN parties.ledger_account_id IS
  'Phase 4: each party owns a ledger under Sundry Debtors (customers) or Sundry Creditors (suppliers). Sale/purchase/payment auto-posts target this ledger instead of the generic AR/AP default.';

-- =============================================================================
-- Block posting to group accounts via DB constraint trigger.
-- Tally enforces this strictly; we mirror it so application bugs can't
-- silently break the trial balance.
-- =============================================================================

CREATE OR REPLACE FUNCTION assert_journal_line_account_is_leaf()
RETURNS TRIGGER AS $$
DECLARE
  account_is_group BOOLEAN;
  account_name TEXT;
BEGIN
  SELECT is_group, name INTO account_is_group, account_name
  FROM accounts
  WHERE id = NEW.account_id;

  IF account_is_group THEN
    RAISE EXCEPTION 'Cannot post journal line to group account "%" — only leaf accounts accept postings', account_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journal_lines_leaf_account_check ON journal_lines;
CREATE TRIGGER journal_lines_leaf_account_check
  BEFORE INSERT OR UPDATE OF account_id ON journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION assert_journal_line_account_is_leaf();

-- =============================================================================
-- Backfill: for every existing party whose tenant has accounting enabled
-- AND the appropriate default account mapped, create a party-specific
-- ledger and link it. Idempotent — skips parties that already have a
-- ledger_account_id, and uses a deterministic code so re-running won't
-- collide.
--
-- Code format: PTY-<first 8 chars of party.id>
-- Parent: tenant's accounts_receivable (customers) or accounts_payable (suppliers).
-- The parent is implicitly converted to is_group=true by the UPDATE below
-- after backfill, so subsequent direct postings to it would fail. The
-- accounting_default_accounts mapping continues to point at it for legacy
-- callers; service code prefers party.ledger_account_id when available.
-- =============================================================================

WITH party_defaults AS (
  SELECT
    p.id            AS party_id,
    p.tenant_id     AS tenant_id,
    p.type          AS party_type,
    p.name          AS party_name,
    p.is_active     AS party_active,
    ada.account_id  AS parent_id,
    'PTY-' || substr(p.id::text, 1, 8) AS new_code
  FROM parties p
  JOIN accounting_default_accounts ada
    ON ada.tenant_id = p.tenant_id
   AND ada.role = CASE p.type
                    WHEN 'customer' THEN 'accounts_receivable'
                    WHEN 'supplier' THEN 'accounts_payable'
                  END
  WHERE p.ledger_account_id IS NULL
),
inserted_accounts AS (
  INSERT INTO accounts (tenant_id, code, name, type, parent_id, balance, is_active)
  SELECT
    pd.tenant_id,
    pd.new_code,
    pd.party_name,
    CASE pd.party_type WHEN 'customer' THEN 'asset' ELSE 'liability' END::account_type,
    pd.parent_id,
    0,
    pd.party_active
  FROM party_defaults pd
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id, tenant_id, code
)
UPDATE parties p
SET ledger_account_id = ia.id
FROM inserted_accounts ia
WHERE ia.tenant_id = p.tenant_id
  AND ia.code = 'PTY-' || substr(p.id::text, 1, 8)
  AND p.ledger_account_id IS NULL;

-- After backfill, mark Sundry Debtors / Sundry Creditors parent accounts
-- (those that now have party ledgers as children) as groups. This blocks
-- new postings to them via the trigger above, forcing all future flows
-- through the party-specific ledger.
UPDATE accounts a
SET is_group = true
WHERE is_group = false
  AND EXISTS (
    SELECT 1 FROM accounts c
    WHERE c.parent_id = a.id AND c.code LIKE 'PTY-%'
  );
