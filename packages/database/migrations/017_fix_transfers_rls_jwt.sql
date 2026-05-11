-- Migration: Fix transfers RLS to use JWT-based tenant isolation
--
-- Background: 005_warehouse_schema.sql created tenant_isolation policies on
-- transfers and transfer_items that compare tenant_id to
-- current_setting('app.tenant_id', true)::uuid. The Node API never sets that
-- session variable, so the policy returns NULL and every authenticated
-- transfer SELECT/INSERT silently fails with RLS rejection.
--
-- Migrations 013_fix_sales_rls_jwt and 015_fix_payments_rls_jwt already moved
-- warehouses, inventory, invoices, parties, and payments onto the JWT-based
-- pattern. This migration extends the same fix to transfers/transfer_items.

DROP POLICY IF EXISTS transfers_tenant_isolation ON transfers;
CREATE POLICY transfers_tenant_isolation ON transfers
  FOR ALL TO authenticated
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS transfer_items_tenant_isolation ON transfer_items;
CREATE POLICY transfer_items_tenant_isolation ON transfer_items
  FOR ALL TO authenticated
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);
