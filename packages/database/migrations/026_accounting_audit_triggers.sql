-- Migration 026: Auto-audit triggers on accounting-critical tables.
-- Phase 8 of the Tally-parity plan.
--
-- Wires the existing audit_logs table (migration 010) to capture every
-- INSERT/UPDATE/DELETE on accounts, journal_entries, bank_accounts,
-- cost categories/centers/allocations, and accounting_default_accounts.
--
-- The result mirrors Tally's "Edit Log" feature: every change to a
-- voucher or master is recorded with before/after JSON and a timestamp,
-- viewable per-entity on the detail page or tenant-wide on the existing
-- audit-logs page.
--
-- Skipped tables (intentional):
--   journal_lines        — derived from parent journal_entries; capturing
--                          each line doubles volume without new signal
--   parties              — owned by the parties module; cross-cuts beyond
--                          accounting scope
--   stock_valuation_layers — internal bookkeeping for FIFO consumption;
--                            already traceable via source_invoice_id
--
-- Dependencies: 010_audit_schema.sql, 011_accounting_schema.sql,
--               021_accounting_defaults_and_idempotency.sql,
--               022_bank_accounts_and_allocations.sql,
--               025_cost_centers.sql

-- =============================================================================
-- auto_audit_changes() — generic trigger function
-- =============================================================================
--
-- Reads tenant_id and (when available) the JWT-bound user id from the
-- current request. user_id is null when the change originates from a
-- service-role context (e.g. a backfill script) — that's expected and
-- still leaves a useful before/after audit row.
--
-- Maps TG_TABLE_NAME to a stable, frontend-friendly entity_type:
--   accounts                    -> account
--   journal_entries             -> journal_entry
--   bank_accounts               -> bank_account
--   cost_categories             -> cost_category
--   cost_centers                -> cost_center
--   journal_line_cost_allocations -> cost_allocation
--   accounting_default_accounts -> accounting_default

CREATE OR REPLACE FUNCTION auto_audit_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_entity_id UUID;
  v_action TEXT;
  v_old JSONB;
  v_new JSONB;
  v_entity_type TEXT;
  v_user_id UUID;
BEGIN
  -- Map physical table -> logical entity type used by the frontend.
  v_entity_type := CASE TG_TABLE_NAME
    WHEN 'journal_entries'              THEN 'journal_entry'
    WHEN 'accounts'                     THEN 'account'
    WHEN 'bank_accounts'                THEN 'bank_account'
    WHEN 'cost_categories'              THEN 'cost_category'
    WHEN 'cost_centers'                 THEN 'cost_center'
    WHEN 'journal_line_cost_allocations' THEN 'cost_allocation'
    WHEN 'accounting_default_accounts'  THEN 'accounting_default'
    ELSE TG_TABLE_NAME
  END;

  -- Resolve tenant_id, entity_id, action, payloads.
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_tenant_id := (row_to_json(NEW)->>'tenant_id')::uuid;
    v_entity_id := (row_to_json(NEW)->>'id')::uuid;
    v_old := NULL;
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_tenant_id := (row_to_json(NEW)->>'tenant_id')::uuid;
    v_entity_id := (row_to_json(NEW)->>'id')::uuid;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  ELSE  -- DELETE
    v_action := 'delete';
    v_tenant_id := (row_to_json(OLD)->>'tenant_id')::uuid;
    v_entity_id := (row_to_json(OLD)->>'id')::uuid;
    v_old := to_jsonb(OLD);
    v_new := NULL;
  END IF;

  -- auth.uid() resolves to the JWT-bound user when invoked from a
  -- supabase-js request; null otherwise (e.g. service-role scripts).
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  INSERT INTO audit_logs (
    tenant_id, user_id, action, entity_type, entity_id, old_values, new_values
  ) VALUES (
    v_tenant_id, v_user_id, v_action, v_entity_type, v_entity_id, v_old, v_new
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_audit_changes() IS
  'Phase 8: generic AFTER-trigger that writes every INSERT/UPDATE/DELETE on the attached table into audit_logs. user_id is best-effort via auth.uid().';

-- =============================================================================
-- Apply the trigger to each accounting-critical table. Idempotent — drop
-- first so a re-run installs the latest version.
-- =============================================================================

DROP TRIGGER IF EXISTS audit_changes ON accounts;
CREATE TRIGGER audit_changes
  AFTER INSERT OR UPDATE OR DELETE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION auto_audit_changes();

DROP TRIGGER IF EXISTS audit_changes ON journal_entries;
CREATE TRIGGER audit_changes
  AFTER INSERT OR UPDATE OR DELETE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_audit_changes();

DROP TRIGGER IF EXISTS audit_changes ON bank_accounts;
CREATE TRIGGER audit_changes
  AFTER INSERT OR UPDATE OR DELETE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION auto_audit_changes();

DROP TRIGGER IF EXISTS audit_changes ON cost_categories;
CREATE TRIGGER audit_changes
  AFTER INSERT OR UPDATE OR DELETE ON cost_categories
  FOR EACH ROW
  EXECUTE FUNCTION auto_audit_changes();

DROP TRIGGER IF EXISTS audit_changes ON cost_centers;
CREATE TRIGGER audit_changes
  AFTER INSERT OR UPDATE OR DELETE ON cost_centers
  FOR EACH ROW
  EXECUTE FUNCTION auto_audit_changes();

DROP TRIGGER IF EXISTS audit_changes ON journal_line_cost_allocations;
CREATE TRIGGER audit_changes
  AFTER INSERT OR UPDATE OR DELETE ON journal_line_cost_allocations
  FOR EACH ROW
  EXECUTE FUNCTION auto_audit_changes();

DROP TRIGGER IF EXISTS audit_changes ON accounting_default_accounts;
CREATE TRIGGER audit_changes
  AFTER INSERT OR UPDATE OR DELETE ON accounting_default_accounts
  FOR EACH ROW
  EXECUTE FUNCTION auto_audit_changes();
