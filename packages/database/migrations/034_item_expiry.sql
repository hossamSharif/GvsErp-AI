-- Migration: 034_item_expiry.sql
-- Description: Add optional per-item expiry date tracking and expiring-items lookup function
-- Author: ERP SaaS Implementation
-- Date: 2026-07-08

-- =============================================================================
-- ITEMS TABLE: EXPIRY COLUMNS
-- =============================================================================

ALTER TABLE items ADD COLUMN IF NOT EXISTS tracks_expiry BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS expiry_date DATE;

DO $$ BEGIN
    ALTER TABLE items ADD CONSTRAINT items_expiry_requires_flag
        CHECK (NOT tracks_expiry OR expiry_date IS NOT NULL);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Index for efficient "expiring soon" queries
CREATE INDEX IF NOT EXISTS idx_items_expiry ON items(tenant_id, expiry_date)
    WHERE tracks_expiry = true AND is_active = true;

-- =============================================================================
-- EXPIRING ITEMS HELPER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION get_expiring_items(p_tenant_id UUID, p_days_threshold INT DEFAULT 30)
RETURNS TABLE (
    item_id UUID,
    item_name TEXT,
    item_sku TEXT,
    expiry_date DATE,
    days_until_expiry INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        it.id AS item_id,
        it.name AS item_name,
        it.sku AS item_sku,
        it.expiry_date,
        (it.expiry_date - CURRENT_DATE)::INT AS days_until_expiry
    FROM items it
    WHERE it.tenant_id = p_tenant_id
      AND it.tracks_expiry = true
      AND it.is_active = true
      AND it.expiry_date IS NOT NULL
      AND it.expiry_date <= (CURRENT_DATE + p_days_threshold)
    ORDER BY it.expiry_date ASC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN items.tracks_expiry IS 'Whether this item has expiry date tracking enabled';
COMMENT ON COLUMN items.expiry_date IS 'Expiry date for this item, required when tracks_expiry is true';
COMMENT ON FUNCTION get_expiring_items IS 'Get active items expiring within N days (default 30)';
