-- Migration: 042_tenant_logos.sql
-- Description: Public `tenant-logos` storage bucket for the company logo printed
--              on invoices and POS receipts. Only the API (service role) writes
--              to it, under <tenant_id>/; the URL is saved in
--              tenants.settings.logo_url. Public so invoice PDFs rendered in the
--              browser can load the image cross-origin.
-- Depends on: core schema
-- Date: 2026-11-08

-- =============================================================================
-- STORAGE BUCKET (public read; writes go through the API with the service role)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'tenant-logos',
    'tenant-logos',
    true,
    2097152,
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
