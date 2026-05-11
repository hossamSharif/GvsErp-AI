-- Migration: 016_ai_connected_services
-- Description: per-user encrypted token vault for external service integrations
-- Created: 2026-04-23
--
-- Phase 6 of docs/genAiAppPlan.md: external MCP integrations need per-user
-- OAuth tokens (Gmail / Drive / Calendar) and tenant-wide tokens (WhatsApp).
-- Tokens are encrypted application-side (Fernet) before INSERT; the DB stores
-- opaque ciphertext. pgcrypto is enabled for gen_random_uuid() availability
-- in older setups, but the actual encrypt/decrypt lives in Python.
--
-- RLS uses the JWT user_metadata.tenant_id pattern (same as migration 014).

-- ============================================
-- EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- ai_connected_services — per-user token vault
-- ============================================

CREATE TABLE IF NOT EXISTS ai_connected_services (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service          TEXT NOT NULL,   -- 'gmail', 'drive', 'calendar', 'whatsapp'
    encrypted_tokens TEXT NOT NULL,   -- Fernet-encrypted JSON (base64 string)
    scopes           TEXT[] NOT NULL DEFAULT '{}',
    connected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One connection per user per service.
CREATE UNIQUE INDEX IF NOT EXISTS ai_connected_services_user_service_idx
    ON ai_connected_services (user_id, service);

-- Fast lookup: "which services does this user have connected?"
CREATE INDEX IF NOT EXISTS ai_connected_services_user_idx
    ON ai_connected_services (user_id);

ALTER TABLE ai_connected_services ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own connections within their tenant.
DROP POLICY IF EXISTS tenant_isolation_ai_connected_services ON ai_connected_services;
CREATE POLICY tenant_isolation_ai_connected_services ON ai_connected_services
    FOR ALL
    USING (
        tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid
        AND user_id = auth.uid()
    )
    WITH CHECK (
        tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid
        AND user_id = auth.uid()
    );
