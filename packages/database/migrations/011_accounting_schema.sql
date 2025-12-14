-- Migration 011: Accounting Module Schema
-- Purpose: Optional accounting module with chart of accounts and journal entries
-- Dependencies: 001_core_schema.sql (tenants table), 004_invoices_schema.sql

-- Account types
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type account_type NOT NULL,
  parent_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  balance DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT accounts_code_check CHECK (length(code) >= 1 AND length(code) <= 20),
  CONSTRAINT accounts_name_check CHECK (length(name) >= 1 AND length(name) <= 255),
  CONSTRAINT accounts_tenant_code_unique UNIQUE (tenant_id, code),
  CONSTRAINT accounts_no_self_parent CHECK (id != parent_id)
);

-- Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT,
  source_type TEXT,
  source_id UUID,
  is_posted BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT journal_entries_tenant_number_unique UNIQUE (tenant_id, entry_number)
);

-- Journal Entry Lines
CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  debit DECIMAL(15,2) DEFAULT 0 CHECK (debit >= 0),
  credit DECIMAL(15,2) DEFAULT 0 CHECK (credit >= 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT journal_lines_debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

-- Indexes for performance
CREATE INDEX idx_accounts_tenant ON accounts(tenant_id);
CREATE INDEX idx_accounts_code ON accounts(tenant_id, code);
CREATE INDEX idx_accounts_type ON accounts(tenant_id, type);
CREATE INDEX idx_accounts_parent ON accounts(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_accounts_active ON accounts(tenant_id, is_active) WHERE is_active = true;

CREATE INDEX idx_journal_entries_tenant ON journal_entries(tenant_id);
CREATE INDEX idx_journal_entries_number ON journal_entries(tenant_id, entry_number);
CREATE INDEX idx_journal_entries_date ON journal_entries(tenant_id, entry_date);
CREATE INDEX idx_journal_entries_source ON journal_entries(tenant_id, source_type, source_id) WHERE source_type IS NOT NULL;
CREATE INDEX idx_journal_entries_posted ON journal_entries(tenant_id, is_posted);

CREATE INDEX idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(tenant_id, account_id);

-- Function to validate journal entry balance (debits = credits)
CREATE OR REPLACE FUNCTION validate_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debits DECIMAL(15,2);
  total_credits DECIMAL(15,2);
BEGIN
  -- Calculate totals for this journal entry
  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO total_debits, total_credits
  FROM journal_lines
  WHERE journal_entry_id = NEW.journal_entry_id;

  -- Check if balanced
  IF total_debits != total_credits THEN
    RAISE EXCEPTION 'Journal entry must be balanced: debits (%) != credits (%)', total_debits, total_credits;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate journal entry balance before posting
CREATE TRIGGER validate_journal_balance_before_post
  BEFORE UPDATE OF is_posted ON journal_entries
  FOR EACH ROW
  WHEN (NEW.is_posted = true AND OLD.is_posted = false)
  EXECUTE FUNCTION validate_journal_entry_balance();

-- Function to update account balances when journal entry is posted
CREATE OR REPLACE FUNCTION update_account_balances_on_post()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_posted = true AND OLD.is_posted = false THEN
    -- Update account balances for all lines in this entry
    UPDATE accounts a
    SET balance = balance + (
      SELECT COALESCE(SUM(debit - credit), 0)
      FROM journal_lines jl
      WHERE jl.journal_entry_id = NEW.id
        AND jl.account_id = a.id
    )
    WHERE id IN (
      SELECT DISTINCT account_id
      FROM journal_lines
      WHERE journal_entry_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update account balances when journal entry is posted
CREATE TRIGGER update_account_balances_trigger
  AFTER UPDATE OF is_posted ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_account_balances_on_post();

-- Function to auto-generate journal entry number
CREATE OR REPLACE FUNCTION generate_journal_entry_number()
RETURNS TRIGGER AS $$
DECLARE
  year_month TEXT;
  sequence_num INTEGER;
BEGIN
  IF NEW.entry_number IS NULL THEN
    -- Format: JE-YYYYMM-XXXX
    year_month := TO_CHAR(NEW.entry_date, 'YYYYMM');

    -- Get next sequence number for this month
    SELECT COALESCE(MAX(
      CAST(
        SUBSTRING(entry_number FROM 'JE-[0-9]{6}-([0-9]{4})') AS INTEGER
      )
    ), 0) + 1
    INTO sequence_num
    FROM journal_entries
    WHERE tenant_id = NEW.tenant_id
      AND entry_number LIKE 'JE-' || year_month || '-%';

    NEW.entry_number := 'JE-' || year_month || '-' || LPAD(sequence_num::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate entry number
CREATE TRIGGER journal_entries_number_trigger
  BEFORE INSERT ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION generate_journal_entry_number();

-- Updated at triggers
CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Tenant isolation
CREATE POLICY tenant_isolation_accounts ON accounts
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_journal_entries ON journal_entries
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_journal_lines ON journal_lines
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Service role bypass
CREATE POLICY service_role_bypass_accounts ON accounts
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY service_role_bypass_journal_entries ON journal_entries
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY service_role_bypass_journal_lines ON journal_lines
  FOR ALL
  TO service_role
  USING (true);

-- Comments
COMMENT ON TABLE accounts IS 'Chart of accounts for the accounting module';
COMMENT ON TABLE journal_entries IS 'Double-entry accounting journal entries';
COMMENT ON TABLE journal_lines IS 'Debit and credit lines for journal entries';
COMMENT ON COLUMN accounts.balance IS 'Running balance updated automatically when journal entries are posted';
COMMENT ON COLUMN journal_entries.is_posted IS 'Posted entries cannot be modified and affect account balances';
COMMENT ON COLUMN journal_entries.source_type IS 'Origin of entry: manual, sale, purchase, payment, etc.';
COMMENT ON COLUMN journal_entries.source_id IS 'Reference to originating transaction (invoice_id, payment_id, etc.)';
