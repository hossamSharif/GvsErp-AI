-- Migration 029: Seed default currency (USD) for every tenant
--
-- Context
-- -------
-- The `currencies` table (009_settings_schema.sql) is per-tenant: rows belong to
-- exactly one tenant via `tenant_id`. There is no app-level tenant provisioning
-- function that seeds baseline currencies, so any tenant created before this
-- migration may have an empty currencies list. The web UI exposes currency
-- dropdowns in Settings → General, Items, Bulk Price, Payments, and Expenses.
-- An empty list makes every one of those dropdowns blank.
--
-- Fix
-- ---
-- 1. Backfill USD for any existing tenant that has zero currencies, marking it
--    as the default.
-- 2. Install an AFTER INSERT trigger on `tenants` that auto-creates a USD row
--    for every newly-provisioned tenant.
-- 3. Backfill `tenants.settings.default_currency` to 'USD' where it is missing,
--    so the General Settings page also previews a sensible default.
--
-- Idempotent: the backfill is gated by NOT EXISTS, the trigger uses
-- ON CONFLICT DO NOTHING, and the JSONB update only touches NULL keys.

-- 1. Backfill USD for tenants with no currencies.
INSERT INTO currencies (tenant_id, code, name, symbol, is_default)
SELECT t.id, 'USD', 'US Dollar', '$', true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM currencies c WHERE c.tenant_id = t.id
);

-- 2. Trigger to seed USD when a new tenant is created.
CREATE OR REPLACE FUNCTION seed_default_currency_for_tenant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO currencies (tenant_id, code, name, symbol, is_default)
  VALUES (NEW.id, 'USD', 'US Dollar', '$', true)
  ON CONFLICT (tenant_id, code) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenants_seed_default_currency ON tenants;
CREATE TRIGGER tenants_seed_default_currency
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION seed_default_currency_for_tenant();

-- 3. Backfill tenants.settings.default_currency when it is null/missing.
UPDATE tenants
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{default_currency}',
  '"USD"'::jsonb,
  true
)
WHERE settings IS NULL
   OR settings->>'default_currency' IS NULL
   OR settings->>'default_currency' = '';

COMMENT ON FUNCTION seed_default_currency_for_tenant() IS
  'Seeds a USD default currency for every newly-provisioned tenant. See migration 029.';
