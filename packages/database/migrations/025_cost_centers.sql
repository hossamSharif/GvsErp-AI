-- Migration 025: Cost categories + cost centers + journal-line allocations
-- Phase 7 of the Tally-parity plan.
--
-- Adds a parallel reporting dimension on top of the chart of accounts.
-- Tally lets a single journal line be split across multiple cost centres
-- (e.g. an electricity bill 70% to "Production", 30% to "Office") — we
-- mirror that with the journal_line_cost_allocations table.
--
-- Strictly additive: tenants who don't create any cost centres see no
-- behavior change. RLS uses the same JWT-path pattern as accounting.
--
-- Dependencies: 011_accounting_schema.sql

-- =============================================================================
-- cost_categories — the dimension itself (Department / Project / Branch / …)
-- =============================================================================

CREATE TABLE IF NOT EXISTS cost_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cost_categories_name_length CHECK (length(name) BETWEEN 1 AND 255),
  CONSTRAINT cost_categories_tenant_name_unique UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cost_categories_tenant ON cost_categories(tenant_id);

ALTER TABLE cost_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cost_categories ON cost_categories
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY service_role_bypass_cost_categories ON cost_categories
  FOR ALL
  TO service_role
  USING (true);

CREATE TRIGGER cost_categories_updated_at
  BEFORE UPDATE ON cost_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- cost_centers — the units that postings get allocated to
-- =============================================================================

CREATE TABLE IF NOT EXISTS cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES cost_categories(id) ON DELETE RESTRICT,
  parent_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cost_centers_code_length CHECK (length(code) BETWEEN 1 AND 50),
  CONSTRAINT cost_centers_name_length CHECK (length(name) BETWEEN 1 AND 255),
  CONSTRAINT cost_centers_tenant_code_unique UNIQUE (tenant_id, code),
  CONSTRAINT cost_centers_no_self_parent CHECK (id != parent_id)
);

CREATE INDEX IF NOT EXISTS idx_cost_centers_tenant ON cost_centers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_category ON cost_centers(tenant_id, category_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_parent ON cost_centers(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cost_centers_active ON cost_centers(tenant_id, is_active) WHERE is_active = true;

ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cost_centers ON cost_centers
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY service_role_bypass_cost_centers ON cost_centers
  FOR ALL
  TO service_role
  USING (true);

CREATE TRIGGER cost_centers_updated_at
  BEFORE UPDATE ON cost_centers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- journal_line_cost_allocations — many-to-many between journal lines and
-- cost centers. A single line can be split across multiple centers; the
-- sum of allocations must not exceed the line's amount.
-- =============================================================================

CREATE TABLE IF NOT EXISTS journal_line_cost_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  journal_line_id UUID NOT NULL REFERENCES journal_lines(id) ON DELETE CASCADE,
  cost_center_id UUID NOT NULL REFERENCES cost_centers(id) ON DELETE RESTRICT,
  amount DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT journal_line_cost_allocations_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_jlc_alloc_tenant ON journal_line_cost_allocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jlc_alloc_line ON journal_line_cost_allocations(journal_line_id);
CREATE INDEX IF NOT EXISTS idx_jlc_alloc_center ON journal_line_cost_allocations(tenant_id, cost_center_id);

ALTER TABLE journal_line_cost_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_jlc_alloc ON journal_line_cost_allocations
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY service_role_bypass_jlc_alloc ON journal_line_cost_allocations
  FOR ALL
  TO service_role
  USING (true);

-- Sum-check trigger: SUM(allocations.amount) per line ≤ line.debit + line.credit
-- (the line amount). Mirrors the Phase-3 payment_allocations pattern.

CREATE OR REPLACE FUNCTION validate_jlc_allocation_sum()
RETURNS TRIGGER AS $$
DECLARE
  lid UUID;
  line_amount DECIMAL(15,2);
  total_allocated DECIMAL(15,2);
BEGIN
  lid := COALESCE(NEW.journal_line_id, OLD.journal_line_id);

  SELECT COALESCE(debit, 0) + COALESCE(credit, 0)
    INTO line_amount
  FROM journal_lines
  WHERE id = lid;

  -- Parent line may have been deleted (CASCADE) — allow.
  IF line_amount IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_allocated
  FROM journal_line_cost_allocations
  WHERE journal_line_id = lid;

  -- 0.01 tolerance for rounding.
  IF total_allocated > line_amount + 0.01 THEN
    RAISE EXCEPTION 'Cost allocations (%) exceed journal line amount (%) for line %',
      total_allocated, line_amount, lid;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_jlc_allocation_sum_after
  AFTER INSERT OR UPDATE OR DELETE ON journal_line_cost_allocations
  FOR EACH ROW
  EXECUTE FUNCTION validate_jlc_allocation_sum();

COMMENT ON TABLE cost_categories IS
  'Phase 7: top-level reporting dimension. Tenants typically have a small handful (Department, Project, Branch).';
COMMENT ON TABLE cost_centers IS
  'Phase 7: the actual units transactions can be tagged with. Optionally hierarchical via parent_id (e.g. Department > Eng > Backend).';
COMMENT ON TABLE journal_line_cost_allocations IS
  'Phase 7: tags a single journal line to one or more cost centers, optionally split by amount. Sum ≤ line.debit + line.credit (trigger).';
