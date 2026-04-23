-- Fix RLS policies on sales-related tables to use the JWT tenant_id claim
-- instead of an unset Postgres session variable.
--
-- Original policies on invoices/invoice_items/invoice_sequences/parties used
-- current_setting('app.current_tenant_id', true) and warehouses/inventory used
-- current_setting('app.tenant_id', true). Neither variable is set by the API
-- middleware, so authenticated CRUD silently failed. The items tables were
-- migrated to the JWT-claim pattern earlier; this migration extends the same
-- fix to all sales dependencies.

-- invoices
DROP POLICY IF EXISTS tenant_isolation_invoices ON invoices;
CREATE POLICY tenant_isolation_invoices ON invoices
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

-- invoice_items
DROP POLICY IF EXISTS tenant_isolation_invoice_items ON invoice_items;
CREATE POLICY tenant_isolation_invoice_items ON invoice_items
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

-- invoice_sequences
DROP POLICY IF EXISTS tenant_isolation_invoice_sequences ON invoice_sequences;
CREATE POLICY tenant_isolation_invoice_sequences ON invoice_sequences
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

-- parties
DROP POLICY IF EXISTS tenant_isolation_parties ON parties;
CREATE POLICY tenant_isolation_parties ON parties
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

-- warehouses
DROP POLICY IF EXISTS warehouses_tenant_isolation ON warehouses;
CREATE POLICY warehouses_tenant_isolation ON warehouses
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

-- inventory
DROP POLICY IF EXISTS inventory_tenant_isolation ON inventory;
CREATE POLICY inventory_tenant_isolation ON inventory
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);
