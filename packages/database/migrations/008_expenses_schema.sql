-- Migration: 008_expenses_schema
-- Description: Create Expense table for tracking business expenses with category, amount, date.
-- Depends on: 001_core_schema (tenants, users)
-- Note: RLS uses the JWT user_metadata.tenant_id claim (not the unset
--       current_setting('app.current_tenant_id') session var that broke earlier
--       tables — see migrations 013/015).

-- =============================================================================
-- EXPENSE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate DECIMAL(15,6) NOT NULL DEFAULT 1,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    reference TEXT,
    payment_method TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT expenses_amount_positive CHECK (amount > 0),
    CONSTRAINT expenses_exchange_rate_positive CHECK (exchange_rate > 0),
    CONSTRAINT expenses_currency_format CHECK (char_length(currency) = 3),
    CONSTRAINT expenses_category_length CHECK (char_length(category) >= 1 AND char_length(category) <= 100)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(tenant_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_amount ON expenses(tenant_id, amount);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method ON expenses(tenant_id, payment_method) WHERE payment_method IS NOT NULL;

-- RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_expenses ON expenses;
CREATE POLICY tenant_isolation_expenses ON expenses
    FOR ALL
    USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS service_role_bypass_expenses ON expenses;
CREATE POLICY service_role_bypass_expenses ON expenses
    FOR ALL
    TO service_role
    USING (true);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_expenses_updated_at ON expenses;
CREATE TRIGGER trigger_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_expenses_updated_at();
