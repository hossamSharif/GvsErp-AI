-- Migration 030: Fix RLS policies on settings tables (currencies, exchange_rates)
-- to read tenant_id from the correct JWT claim path.
--
-- Context
-- -------
-- 009_settings_schema.sql created RLS policies of the form:
--   USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
-- but Supabase puts the tenant_id claim under user_metadata, not at the
-- JWT root. So auth.jwt() ->> 'tenant_id' evaluates to NULL and
-- NULL = tenant_id is NULL (not TRUE), which:
--   - silently filters every SELECT to zero rows (Currencies page appears
--     empty), and
--   - blocks every INSERT/UPDATE/DELETE with
--     "new row violates row-level security policy for table 'currencies'"
--     because the FOR ALL policy has no explicit WITH CHECK clause and so
--     falls back to USING.
--
-- The same bug shape was fixed for invoices/parties/warehouses in 013,
-- payments in 015, transfers in 017, and accounting in 020. This migration
-- extends the same JWT-claim fix to the settings tables.

-- currencies
DROP POLICY IF EXISTS tenant_isolation_currencies ON currencies;
CREATE POLICY tenant_isolation_currencies ON currencies
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

-- exchange_rates
DROP POLICY IF EXISTS tenant_isolation_exchange_rates ON exchange_rates;
CREATE POLICY tenant_isolation_exchange_rates ON exchange_rates
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);
