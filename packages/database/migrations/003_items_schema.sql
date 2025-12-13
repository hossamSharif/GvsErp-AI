-- Migration: 003_items_schema
-- Description: Create Item, ItemPrice, ItemPackaging, and Category tables
-- Depends on: 001_core_schema (tenants table)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- CATEGORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT categories_name_length CHECK (char_length(name) BETWEEN 1 AND 255)
);

-- Indexes for categories
CREATE INDEX idx_categories_tenant ON categories(tenant_id);
CREATE INDEX idx_categories_parent ON categories(tenant_id, parent_id);
CREATE UNIQUE INDEX idx_categories_name_unique ON categories(tenant_id, parent_id, name)
    WHERE parent_id IS NOT NULL;
CREATE UNIQUE INDEX idx_categories_name_root_unique ON categories(tenant_id, name)
    WHERE parent_id IS NULL;

-- RLS for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_categories ON categories
    FOR ALL
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE POLICY service_role_bypass_categories ON categories
    FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- ITEM TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_alias TEXT,
    sku TEXT,
    barcode TEXT,
    brand TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    unit_of_measure TEXT NOT NULL DEFAULT 'piece',
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT items_name_length CHECK (char_length(name) BETWEEN 1 AND 255),
    CONSTRAINT items_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 100)
);

-- Indexes for items
CREATE INDEX idx_items_tenant ON items(tenant_id);
CREATE INDEX idx_items_name ON items(tenant_id, name);
CREATE INDEX idx_items_category ON items(tenant_id, category_id);
CREATE INDEX idx_items_active ON items(tenant_id, is_active);
CREATE UNIQUE INDEX idx_items_sku_unique ON items(tenant_id, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX idx_items_barcode_unique ON items(tenant_id, barcode) WHERE barcode IS NOT NULL;

-- Full-text search index for items
CREATE INDEX idx_items_search ON items USING gin(
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(name_alias, '') || ' ' || coalesce(sku, '') || ' ' || coalesce(barcode, '') || ' ' || coalesce(brand, ''))
);

-- RLS for items
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_items ON items
    FOR ALL
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE POLICY service_role_bypass_items ON items
    FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- ITEM PRICE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS item_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    price_tier TEXT NOT NULL DEFAULT 'retail',
    price DECIMAL(15,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    effective_from DATE,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT item_prices_price_positive CHECK (price >= 0),
    CONSTRAINT item_prices_date_range CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);

-- Indexes for item_prices
CREATE INDEX idx_item_prices_tenant ON item_prices(tenant_id);
CREATE INDEX idx_item_prices_item ON item_prices(item_id);
CREATE INDEX idx_item_prices_tier ON item_prices(tenant_id, price_tier);
CREATE INDEX idx_item_prices_effective ON item_prices(item_id, effective_from, effective_to);
CREATE UNIQUE INDEX idx_item_prices_unique ON item_prices(item_id, price_tier, currency, effective_from)
    WHERE effective_from IS NOT NULL;
CREATE UNIQUE INDEX idx_item_prices_unique_no_date ON item_prices(item_id, price_tier, currency)
    WHERE effective_from IS NULL;

-- RLS for item_prices
ALTER TABLE item_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_item_prices ON item_prices
    FOR ALL
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE POLICY service_role_bypass_item_prices ON item_prices
    FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- ITEM PACKAGING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS item_packagings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    barcode TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT item_packagings_quantity_positive CHECK (quantity > 0),
    CONSTRAINT item_packagings_name_length CHECK (char_length(name) BETWEEN 1 AND 100)
);

-- Indexes for item_packagings
CREATE INDEX idx_item_packagings_tenant ON item_packagings(tenant_id);
CREATE INDEX idx_item_packagings_item ON item_packagings(item_id);
CREATE UNIQUE INDEX idx_item_packagings_barcode_unique ON item_packagings(tenant_id, barcode)
    WHERE barcode IS NOT NULL;

-- RLS for item_packagings
ALTER TABLE item_packagings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_item_packagings ON item_packagings
    FOR ALL
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE POLICY service_role_bypass_item_packagings ON item_packagings
    FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at for items
CREATE OR REPLACE FUNCTION update_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_items_updated_at();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get the current effective price for an item
CREATE OR REPLACE FUNCTION get_item_price(
    p_item_id UUID,
    p_price_tier TEXT DEFAULT 'retail',
    p_currency TEXT DEFAULT 'USD',
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    v_price DECIMAL(15,2);
BEGIN
    SELECT price INTO v_price
    FROM item_prices
    WHERE item_id = p_item_id
      AND price_tier = p_price_tier
      AND currency = p_currency
      AND (effective_from IS NULL OR effective_from <= p_date)
      AND (effective_to IS NULL OR effective_to >= p_date)
    ORDER BY effective_from DESC NULLS LAST
    LIMIT 1;

    RETURN v_price;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to validate category hierarchy depth (max 5 levels)
CREATE OR REPLACE FUNCTION check_category_depth()
RETURNS TRIGGER AS $$
DECLARE
    v_depth INTEGER := 0;
    v_parent_id UUID := NEW.parent_id;
BEGIN
    WHILE v_parent_id IS NOT NULL AND v_depth < 6 LOOP
        v_depth := v_depth + 1;
        SELECT parent_id INTO v_parent_id FROM categories WHERE id = v_parent_id;
    END LOOP;

    IF v_depth >= 5 THEN
        RAISE EXCEPTION 'Category hierarchy cannot exceed 5 levels';
    END IF;

    -- Check for circular reference
    IF NEW.id IS NOT NULL AND NEW.parent_id IS NOT NULL THEN
        v_parent_id := NEW.parent_id;
        WHILE v_parent_id IS NOT NULL LOOP
            IF v_parent_id = NEW.id THEN
                RAISE EXCEPTION 'Circular category reference detected';
            END IF;
            SELECT parent_id INTO v_parent_id FROM categories WHERE id = v_parent_id;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_category_depth
    BEFORE INSERT OR UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION check_category_depth();
