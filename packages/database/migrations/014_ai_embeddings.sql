-- Migration: 014_ai_embeddings
-- Description: pgvector-backed RAG store + balance snapshots for the apps/ai companion
-- Created: 2026-04-23
--
-- Phase 4 of docs/genAiAppPlan.md: graduate Chroma in-memory → pgvector in Supabase.
-- The schema mirrors what LangChain's SupabaseVectorStore expects (id/content/metadata/
-- embedding columns) plus tenant_id + source_table + source_id so the AI app can do
-- idempotent re-embedding keyed by ERP source row.
--
-- RLS uses the JWT user_metadata.tenant_id pattern (NOT the broken
-- current_setting('app.current_tenant_id', true) pattern from earlier migrations —
-- see 013_fix_sales_rls_jwt.sql for the rationale).

-- ============================================
-- EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- ai_embeddings — vector store
-- ============================================

CREATE TABLE IF NOT EXISTS ai_embeddings (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_table TEXT NOT NULL,
    source_id    TEXT NOT NULL,
    content      TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    embedding    vector(768) NOT NULL,
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS ai_embeddings_tenant_source_idx
    ON ai_embeddings (tenant_id, source_table);

-- ivfflat is a Postgres-side ANN index for cosine similarity. lists=100 is a sane
-- default for tens of thousands of rows; tune up as the corpus grows.
CREATE INDEX IF NOT EXISTS ai_embeddings_ivfflat
    ON ai_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

ALTER TABLE ai_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ai_embeddings ON ai_embeddings;
CREATE POLICY tenant_isolation_ai_embeddings ON ai_embeddings
    FOR ALL
    USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

-- ============================================
-- match_ai_embeddings — RPC consumed by LangChain SupabaseVectorStore
-- ============================================
--
-- SupabaseVectorStore.similarity_search() POSTs to this RPC. SECURITY INVOKER
-- (default) means RLS still applies during the SELECT — the caller's JWT scopes
-- results to their tenant automatically, even though the embedding column has
-- no tenant_id in its index.

CREATE OR REPLACE FUNCTION match_ai_embeddings (
    query_embedding vector(768),
    match_count     INT DEFAULT 5,
    filter          JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id         UUID,
    content    TEXT,
    metadata   JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.content,
        e.metadata,
        1 - (e.embedding <=> query_embedding) AS similarity
    FROM ai_embeddings e
    WHERE e.metadata @> filter
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================
-- ai_balance_snapshots — hourly outstanding-balance materialization
-- ============================================
--
-- The hourly pipeline writes one row per party so the agent can answer
-- "how has ACME's outstanding balance trended this week?" without re-aggregating
-- the invoices table on every chat turn.

CREATE TABLE IF NOT EXISTS ai_balance_snapshots (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    party_id    UUID NOT NULL,
    party_name  TEXT,
    balance     NUMERIC NOT NULL,
    currency    TEXT,
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_balance_snapshots_party_time_idx
    ON ai_balance_snapshots (tenant_id, party_id, snapshot_at DESC);

ALTER TABLE ai_balance_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ai_balance_snapshots ON ai_balance_snapshots;
CREATE POLICY tenant_isolation_ai_balance_snapshots ON ai_balance_snapshots
    FOR ALL
    USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);
