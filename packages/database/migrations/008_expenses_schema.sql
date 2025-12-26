-- Migration: 008_expenses_schema.sql
-- Description: Create Expense and ExpenseCategory tables for US7 - Track Business Expenses
-- Date: 2025-12-14

-- ============================================================================
-- Expense Categories Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_expense_categories_tenant ON expense_categories(tenant_id);
CREATE INDEX idx_expense_categories_parent ON expense_categories(parent_id) WHERE parent_id IS NOT NULL;

-- Enable RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY tenant_isolation_expense_categories ON expense_categories
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY service_role_bypass_expense_categories ON expense_categories
  FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- Expenses Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate DECIMAL(15,6) NOT NULL DEFAULT 1.0 CHECK (exchange_rate > 0),
  description TEXT,
  expense_date DATE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX idx_expenses_category ON expenses(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_expenses_date ON expenses(tenant_id, expense_date DESC);
CREATE INDEX idx_expenses_created_by ON expenses(created_by) WHERE created_by IS NOT NULL;

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY tenant_isolation_expenses ON expenses
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY service_role_bypass_expenses ON expenses
  FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();

CREATE TRIGGER expense_categories_updated_at
  BEFORE UPDATE ON expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();

-- ============================================================================
-- Insert default expense categories
-- ============================================================================

-- Note: These will be inserted per tenant on tenant creation
-- Default categories: Rent, Utilities, Salaries, Marketing, Supplies, Other

COMMENT ON TABLE expenses IS 'Business expenses tracking with categorization';
COMMENT ON TABLE expense_categories IS 'Hierarchical expense categories';
