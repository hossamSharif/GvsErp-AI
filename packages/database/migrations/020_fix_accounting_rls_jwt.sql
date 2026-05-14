-- Fix RLS policies on accounting tables to read tenant_id from the
-- user_metadata path inside the Supabase JWT (the API stores tenant_id under
-- user_metadata, see apps/api/src/middleware/auth.ts). The original policies
-- in migration 011 used `auth.jwt() ->> 'tenant_id'`, which always resolves
-- to NULL because the claim is nested under user_metadata. As a result
-- every authenticated insert/select on accounts, journal_entries, and
-- journal_lines silently failed under RLS — accounting activation reported
-- success but created zero accounts. Extends the JWT-path fix used in
-- migrations 013/015/017.

-- accounts
DROP POLICY IF EXISTS tenant_isolation_accounts ON accounts;
CREATE POLICY tenant_isolation_accounts ON accounts
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

-- journal_entries
DROP POLICY IF EXISTS tenant_isolation_journal_entries ON journal_entries;
CREATE POLICY tenant_isolation_journal_entries ON journal_entries
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

-- journal_lines
DROP POLICY IF EXISTS tenant_isolation_journal_lines ON journal_lines;
CREATE POLICY tenant_isolation_journal_lines ON journal_lines
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);
