-- Fix RLS on payment-related tables to use the JWT tenant_id claim
-- instead of the unset current_setting('app.current_tenant_id') session var.
-- Extends the fix from migration 013 (items, invoices, parties, warehouses,
-- inventory) to the remaining payment tables.

-- payments
DROP POLICY IF EXISTS tenant_isolation_payments ON payments;
CREATE POLICY tenant_isolation_payments ON payments
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

-- payment_sequences
DROP POLICY IF EXISTS tenant_isolation_payment_sequences ON payment_sequences;
CREATE POLICY tenant_isolation_payment_sequences ON payment_sequences
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);
