-- Migration: 005_warehouse_schema.sql
-- Description: Create Warehouse, Inventory, Transfer, and TransferItem tables
-- Author: ERP SaaS Implementation
-- Date: 2025-12-14

-- =============================================================================
-- WAREHOUSES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant ON warehouses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_active ON warehouses(tenant_id, is_active);

-- RLS
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY warehouses_tenant_isolation ON warehouses
    FOR ALL
    USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

CREATE POLICY warehouses_service_role_bypass ON warehouses
    FOR ALL
    TO service_role
    USING (true);

-- Updated at trigger
CREATE TRIGGER set_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- INVENTORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
    reserved_quantity DECIMAL(15,3) DEFAULT 0,
    low_stock_threshold DECIMAL(15,3),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure one inventory record per item per warehouse
    CONSTRAINT inventory_item_warehouse_unique UNIQUE(item_id, warehouse_id),
    -- Quantity cannot be negative
    CONSTRAINT inventory_quantity_non_negative CHECK (quantity >= 0),
    CONSTRAINT inventory_reserved_non_negative CHECK (reserved_quantity >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_warehouse ON inventory(tenant_id, item_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(tenant_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(tenant_id, warehouse_id)
    WHERE low_stock_threshold IS NOT NULL AND quantity <= low_stock_threshold;

-- RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_tenant_isolation ON inventory
    FOR ALL
    USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

CREATE POLICY inventory_service_role_bypass ON inventory
    FOR ALL
    TO service_role
    USING (true);

-- Updated at trigger
CREATE TRIGGER set_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TRANSFERS TABLE
-- =============================================================================

-- Transfer status enum
DO $$ BEGIN
    CREATE TYPE transfer_status AS ENUM ('pending', 'in_transit', 'completed', 'canceled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    transfer_number TEXT NOT NULL,
    from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    status transfer_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,

    -- Cannot transfer to the same warehouse
    CONSTRAINT transfer_different_warehouses CHECK (from_warehouse_id != to_warehouse_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transfers_tenant ON transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transfers_number ON transfers(tenant_id, transfer_number);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_from_warehouse ON transfers(tenant_id, from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_warehouse ON transfers(tenant_id, to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(tenant_id, created_at);

-- RLS
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY transfers_tenant_isolation ON transfers
    FOR ALL
    USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

CREATE POLICY transfers_service_role_bypass ON transfers
    FOR ALL
    TO service_role
    USING (true);

-- Updated at trigger
CREATE TRIGGER set_transfers_updated_at
    BEFORE UPDATE ON transfers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TRANSFER ITEMS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),
    quantity DECIMAL(15,3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Quantity must be positive
    CONSTRAINT transfer_item_quantity_positive CHECK (quantity > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transfer_items_tenant ON transfer_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_item ON transfer_items(tenant_id, item_id);

-- RLS
ALTER TABLE transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY transfer_items_tenant_isolation ON transfer_items
    FOR ALL
    USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

CREATE POLICY transfer_items_service_role_bypass ON transfer_items
    FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- TRANSFER NUMBER SEQUENCE
-- =============================================================================

-- Create a sequence for transfer numbers per tenant per month
CREATE OR REPLACE FUNCTION generate_transfer_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_year_month TEXT;
    v_sequence INT;
    v_transfer_number TEXT;
BEGIN
    v_year_month := to_char(now(), 'YYYYMM');

    -- Get the next sequence number for this tenant and month
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(transfer_number FROM 'TRF-[0-9]{6}-([0-9]+)') AS INT)
    ), 0) + 1
    INTO v_sequence
    FROM transfers
    WHERE tenant_id = p_tenant_id
      AND transfer_number LIKE 'TRF-' || v_year_month || '-%';

    v_transfer_number := 'TRF-' || v_year_month || '-' || LPAD(v_sequence::TEXT, 4, '0');

    RETURN v_transfer_number;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- INVENTORY HELPER FUNCTIONS
-- =============================================================================

-- Function to get or create inventory record
CREATE OR REPLACE FUNCTION get_or_create_inventory(
    p_tenant_id UUID,
    p_item_id UUID,
    p_warehouse_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_inventory_id UUID;
BEGIN
    -- Try to find existing inventory record
    SELECT id INTO v_inventory_id
    FROM inventory
    WHERE tenant_id = p_tenant_id
      AND item_id = p_item_id
      AND warehouse_id = p_warehouse_id;

    -- If not found, create one
    IF v_inventory_id IS NULL THEN
        INSERT INTO inventory (tenant_id, item_id, warehouse_id, quantity, reserved_quantity)
        VALUES (p_tenant_id, p_item_id, p_warehouse_id, 0, 0)
        RETURNING id INTO v_inventory_id;
    END IF;

    RETURN v_inventory_id;
END;
$$ LANGUAGE plpgsql;

-- Function to adjust inventory quantity
CREATE OR REPLACE FUNCTION adjust_inventory(
    p_tenant_id UUID,
    p_item_id UUID,
    p_warehouse_id UUID,
    p_quantity_change DECIMAL(15,3),
    p_reserved_change DECIMAL(15,3) DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
    v_inventory_id UUID;
    v_new_quantity DECIMAL(15,3);
    v_new_reserved DECIMAL(15,3);
BEGIN
    -- Get or create inventory record
    v_inventory_id := get_or_create_inventory(p_tenant_id, p_item_id, p_warehouse_id);

    -- Update inventory
    UPDATE inventory
    SET quantity = quantity + p_quantity_change,
        reserved_quantity = reserved_quantity + p_reserved_change,
        updated_at = now()
    WHERE id = v_inventory_id
    RETURNING quantity, reserved_quantity INTO v_new_quantity, v_new_reserved;

    -- Validate constraints
    IF v_new_quantity < 0 THEN
        RAISE EXCEPTION 'Insufficient inventory quantity';
    END IF;

    IF v_new_reserved < 0 THEN
        RAISE EXCEPTION 'Invalid reserved quantity';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check low stock items
CREATE OR REPLACE FUNCTION get_low_stock_items(p_tenant_id UUID, p_warehouse_id UUID DEFAULT NULL)
RETURNS TABLE (
    item_id UUID,
    item_name TEXT,
    warehouse_id UUID,
    warehouse_name TEXT,
    quantity DECIMAL(15,3),
    low_stock_threshold DECIMAL(15,3)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.item_id,
        it.name AS item_name,
        i.warehouse_id,
        w.name AS warehouse_name,
        i.quantity,
        i.low_stock_threshold
    FROM inventory i
    JOIN items it ON it.id = i.item_id
    JOIN warehouses w ON w.id = i.warehouse_id
    WHERE i.tenant_id = p_tenant_id
      AND i.low_stock_threshold IS NOT NULL
      AND i.quantity <= i.low_stock_threshold
      AND it.is_active = true
      AND w.is_active = true
      AND (p_warehouse_id IS NULL OR i.warehouse_id = p_warehouse_id)
    ORDER BY (i.quantity / NULLIF(i.low_stock_threshold, 0)) ASC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE warehouses IS 'Physical or logical storage locations';
COMMENT ON TABLE inventory IS 'Stock levels per item per warehouse';
COMMENT ON TABLE transfers IS 'Stock transfers between warehouses';
COMMENT ON TABLE transfer_items IS 'Items in a transfer';
COMMENT ON FUNCTION generate_transfer_number IS 'Generate unique transfer number in format TRF-YYYYMM-XXXX';
COMMENT ON FUNCTION get_or_create_inventory IS 'Get existing or create new inventory record';
COMMENT ON FUNCTION adjust_inventory IS 'Adjust inventory quantity with validation';
COMMENT ON FUNCTION get_low_stock_items IS 'Get items below low stock threshold';
