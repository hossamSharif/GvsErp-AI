-- Migration: 040_expense_categories.sql
-- Description: Tenant-managed expense categories. expenses.category stays a
--              text name (no FK) so existing data, reports and journal entry
--              descriptions are untouched; this table is the list users pick
--              from and manage (add / rename / deactivate / delete).
-- Depends on: 008_expenses_schema
-- Date: 2026-11-02

-- =============================================================================
-- EXPENSE CATEGORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT expense_categories_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_categories_tenant_name
    ON expense_categories(tenant_id, lower(name));

-- RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_expense_categories ON expense_categories;
CREATE POLICY tenant_isolation_expense_categories ON expense_categories
    FOR ALL
    USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS service_role_bypass_expense_categories ON expense_categories;
CREATE POLICY service_role_bypass_expense_categories ON expense_categories
    FOR ALL
    TO service_role
    USING (true);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_expense_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_expense_categories_updated_at ON expense_categories;
CREATE TRIGGER trigger_expense_categories_updated_at
    BEFORE UPDATE ON expense_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_expense_categories_updated_at();

-- =============================================================================
-- BACKFILL
-- =============================================================================

-- Built-in defaults are stored by key (rent, utilities, ...) and translated in
-- the UI; tenants created later are seeded lazily by the API.
INSERT INTO expense_categories (tenant_id, name)
SELECT t.id, d.name
FROM tenants t
CROSS JOIN (VALUES
    ('rent'), ('utilities'), ('salaries'), ('office_supplies'), ('travel'),
    ('marketing'), ('maintenance'), ('taxes'), ('insurance'),
    ('professional_services'), ('software'), ('meals'), ('transportation'),
    ('other')
) AS d(name)
ON CONFLICT DO NOTHING;

-- Any custom category text already used on expenses.
INSERT INTO expense_categories (tenant_id, name)
SELECT DISTINCT ON (tenant_id, lower(category)) tenant_id, category
FROM expenses
WHERE char_length(category) BETWEEN 1 AND 100
ON CONFLICT DO NOTHING;

-- =============================================================================
-- USAGE FUNCTION
-- =============================================================================

-- Expense count per category name (aggregated in SQL to avoid the PostgREST
-- row cap when a tenant has many expenses).
CREATE OR REPLACE FUNCTION expense_category_usage(p_tenant_id UUID)
RETURNS TABLE (category TEXT, expense_count BIGINT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT e.category, count(*)
    FROM expenses e
    WHERE e.tenant_id = p_tenant_id
    GROUP BY e.category;
$$;

-- =============================================================================
-- RENAME FUNCTION
-- =============================================================================

-- SECURITY INVOKER (default): RLS on expense_categories/expenses applies.
-- Renames the category and every expense using the old name in one transaction.
CREATE OR REPLACE FUNCTION rename_expense_category(
    p_tenant_id UUID,
    p_id UUID,
    p_new_name TEXT
)
RETURNS SETOF expense_categories
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_old_name TEXT;
BEGIN
    SELECT name INTO v_old_name
    FROM expense_categories
    WHERE id = p_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    UPDATE expenses
    SET category = p_new_name
    WHERE tenant_id = p_tenant_id AND category = v_old_name;

    RETURN QUERY
    UPDATE expense_categories
    SET name = p_new_name
    WHERE id = p_id AND tenant_id = p_tenant_id
    RETURNING *;
END;
$$;
