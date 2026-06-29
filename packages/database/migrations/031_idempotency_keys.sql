-- Migration 031: Idempotency keys for offline-first sync replay
--
-- The offline PWA queues operational mutations (invoice create/finalize,
-- payments, POS sales, transfers) and replays them on reconnect. A replay can
-- be retried after an ambiguous network failure, so each replay carries a
-- unique `Idempotency-Key`. This table lets the API short-circuit a duplicate
-- replay and return the SAME response it produced the first time, instead of
-- creating the record twice (double stock movement / double posting).
--
-- Strictly additive. RLS uses the same JWT-path pattern as accounting/cost
-- centres so it is scoped per tenant.
--
-- Dependencies: 001_core_schema.sql

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Client-generated UUID, unique per tenant.
  key TEXT NOT NULL,
  method TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT idempotency_keys_tenant_key_unique UNIQUE (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_tenant ON idempotency_keys(tenant_id);
-- Allow periodic cleanup of old keys.
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created ON idempotency_keys(created_at);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_idempotency_keys ON idempotency_keys
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY service_role_bypass_idempotency_keys ON idempotency_keys
  FOR ALL
  TO service_role
  USING (true);
