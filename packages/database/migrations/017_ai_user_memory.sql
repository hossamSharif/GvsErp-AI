-- Migration: 017_ai_user_memory
-- Description: long-term per-user memory for the apps/ai LangGraph agent
-- Created: 2026-04-25
--
-- Phase 7 of docs/genAiAppPlan.md: the LangGraph agent retrieves persistent
-- per-user facts ("user prefers USD", "always reply in Arabic", "default
-- warehouse = …") at the start of each turn and prepends them to the system
-- prompt.  Survives across chat sessions, unlike st.session_state.
--
-- RLS uses the JWT user_metadata.tenant_id pattern (same as migrations
-- 014 and 016 — see 013_fix_sales_rls_jwt.sql for the rationale).

CREATE TABLE IF NOT EXISTS ai_user_memory (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (user, key) — upsert-on-conflict updates the value in place.
CREATE UNIQUE INDEX IF NOT EXISTS ai_user_memory_user_key_idx
    ON ai_user_memory (user_id, key);

CREATE INDEX IF NOT EXISTS ai_user_memory_user_idx
    ON ai_user_memory (user_id);

ALTER TABLE ai_user_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ai_user_memory ON ai_user_memory;
CREATE POLICY tenant_isolation_ai_user_memory ON ai_user_memory
    FOR ALL
    USING (
        tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid
        AND user_id = auth.uid()
    )
    WITH CHECK (
        tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid
        AND user_id = auth.uid()
    );
