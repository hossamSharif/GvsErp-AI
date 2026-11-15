-- 045_fix_items_audit_rls_jwt.sql
--
-- Restores a migration that was applied to the cloud database but never
-- committed. 013_fix_sales_rls_jwt.sql says "The items tables were migrated
-- to the JWT-claim pattern earlier", yet no migration in the repo does it, so
-- on a fresh database items/categories/item_prices/item_packagings and
-- audit_logs kept the original policies based on
-- current_setting('app.current_tenant_id'), which the API never sets —
-- every insert failed with "new row violates row-level security policy".
--
-- Same pattern and policy names as 013/015/017/020/030. On the cloud
-- database this replaces each policy with an equivalent one.

-- categories
DROP POLICY IF EXISTS tenant_isolation_categories ON categories;
CREATE POLICY tenant_isolation_categories ON categories
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

-- items
DROP POLICY IF EXISTS tenant_isolation_items ON items;
CREATE POLICY tenant_isolation_items ON items
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

-- item_prices
DROP POLICY IF EXISTS tenant_isolation_item_prices ON item_prices;
CREATE POLICY tenant_isolation_item_prices ON item_prices
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

-- item_packagings
DROP POLICY IF EXISTS tenant_isolation_item_packagings ON item_packagings;
CREATE POLICY tenant_isolation_item_packagings ON item_packagings
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

-- audit_logs
DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);
