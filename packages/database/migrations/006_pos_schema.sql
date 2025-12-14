-- Migration: POS Location Schema
-- Description: Create Point of Sale locations table
-- Dependencies: 001_core_schema.sql, 005_warehouse_schema.sql
-- Date: 2025-12-14

-- =====================================================
-- POSLocation Table
-- =====================================================
-- Point of sale locations with receipt templates and configurations

CREATE TABLE pos_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT pos_locations_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT pos_locations_settings_valid CHECK (jsonb_typeof(settings) = 'object')
);

-- =====================================================
-- Indexes
-- =====================================================

-- Tenant isolation and fast lookups
CREATE INDEX idx_pos_locations_tenant ON pos_locations(tenant_id);
CREATE INDEX idx_pos_locations_warehouse ON pos_locations(tenant_id, warehouse_id);
CREATE INDEX idx_pos_locations_active ON pos_locations(tenant_id, is_active) WHERE is_active = true;

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE pos_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's POS locations
CREATE POLICY tenant_isolation ON pos_locations
  FOR ALL
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Policy: Service role bypasses RLS (for admin operations)
CREATE POLICY service_role_bypass ON pos_locations
  FOR ALL
  TO service_role
  USING (true);

-- =====================================================
-- Triggers
-- =====================================================

-- Auto-update updated_at timestamp
CREATE TRIGGER set_pos_locations_updated_at
  BEFORE UPDATE ON pos_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE pos_locations IS 'Point of sale locations with receipt templates and discount configurations';
COMMENT ON COLUMN pos_locations.id IS 'Primary key';
COMMENT ON COLUMN pos_locations.tenant_id IS 'Tenant ownership for multi-tenancy';
COMMENT ON COLUMN pos_locations.name IS 'POS location name (e.g., Main Store, Branch 1)';
COMMENT ON COLUMN pos_locations.warehouse_id IS 'Linked warehouse for stock tracking';
COMMENT ON COLUMN pos_locations.settings IS 'Configuration: receipt template, discount rules, loyalty settings, tax defaults';
COMMENT ON COLUMN pos_locations.is_active IS 'Soft delete flag';
COMMENT ON COLUMN pos_locations.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN pos_locations.updated_at IS 'Record last update timestamp';

-- =====================================================
-- Sample Settings JSON Structure
-- =====================================================
-- {
--   "receipt": {
--     "header": "Welcome to Our Store",
--     "footer": "Thank you for your business",
--     "show_logo": true,
--     "logo_url": "https://...",
--     "show_barcode": true
--   },
--   "discounts": {
--     "max_discount_percent": 20,
--     "require_manager_approval": true,
--     "manager_approval_threshold": 10
--   },
--   "loyalty": {
--     "enabled": false,
--     "points_per_currency": 1,
--     "redemption_rate": 0.01
--   },
--   "tax": {
--     "default_rate": 14,
--     "tax_inclusive": false
--   },
--   "payment_methods": ["cash", "card", "mobile"]
-- }
