-- Migration: 041_invoice_shares.sql
-- Description: Short share links for invoice PDFs sent over WhatsApp. The PDF
--              lives in the private `invoice-shares` storage bucket; the public
--              link /s/<token> resolves the token to a short-lived signed URL
--              through the API (service role), so the bucket stays private.
-- Depends on: invoices schema
-- Date: 2026-11-05

-- =============================================================================
-- INVOICE SHARE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoice_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    phone TEXT,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Short-lived to keep storage small; the API purges expired PDFs.
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),

    CONSTRAINT invoice_shares_token_length CHECK (char_length(token) BETWEEN 8 AND 32),
    CONSTRAINT invoice_shares_channel_check CHECK (channel IN ('whatsapp'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_shares_token ON invoice_shares(token);
CREATE INDEX IF NOT EXISTS idx_invoice_shares_tenant_invoice
    ON invoice_shares(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_shares_expires_at ON invoice_shares(expires_at);

-- RLS
ALTER TABLE invoice_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_invoice_shares ON invoice_shares;
CREATE POLICY tenant_isolation_invoice_shares ON invoice_shares
    FOR ALL
    USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS service_role_bypass_invoice_shares ON invoice_shares;
CREATE POLICY service_role_bypass_invoice_shares ON invoice_shares
    FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- STORAGE BUCKET (private; only the service role reads/writes it)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoice-shares', 'invoice-shares', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
