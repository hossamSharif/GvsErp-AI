-- Migration: 037_stock_settlements.sql
-- Description: Inventory settlement (stock adjustment) documents — physical-count
--              corrections to warehouse on-hand, with FIFO valuation upkeep and a
--              single adjusting journal entry per posted document.
-- Author: ERP SaaS Implementation
-- Date: 2026-08-13
--
-- SAFETY NOTE — this migration is deliberately STRICTLY ADDITIVE. It creates new
-- types/tables/functions, adds ONE nullable column to stock_valuation_layers, and
-- widens one CHECK constraint. It performs no backfill UPDATE, drops nothing, and
-- rewrites no existing row. Existing tenants are unaffected until they post their
-- first settlement.
--
-- Why a nullable discriminator instead of a `source_type` column with a backfill:
-- opening layers are identified across the codebase as `source_invoice_id IS NULL`.
-- Rather than rewriting all existing layers to carry an explicit kind, settlement
-- layers are marked by `source_settlement_id IS NOT NULL`, so the opening-layer
-- predicate simply becomes
--     source_invoice_id IS NULL AND source_settlement_id IS NULL
-- which classifies every pre-existing row exactly as before.

-- =============================================================================
-- ENUMS
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE settlement_status AS ENUM ('draft', 'posted', 'canceled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE settlement_reason AS ENUM (
        'count_correction',
        'damage',
        'theft',
        'expiry',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- SETTLEMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    settlement_number TEXT NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status settlement_status NOT NULL DEFAULT 'draft',
    reason settlement_reason NOT NULL DEFAULT 'count_correction',
    notes TEXT,

    -- Set when the document is posted.
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    total_increase_value NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_decrease_value NUMERIC(15,2) NOT NULL DEFAULT 0,

    -- When this document is the mirror that reverses another one.
    reversal_of_id UUID REFERENCES settlements(id) ON DELETE SET NULL,

    created_by UUID REFERENCES users(id),
    posted_by UUID REFERENCES users(id),
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT settlements_number_unique UNIQUE (tenant_id, settlement_number)
);

CREATE INDEX IF NOT EXISTS idx_settlements_tenant ON settlements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_warehouse_date
    ON settlements(tenant_id, warehouse_id, settlement_date);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_settlements_reversal ON settlements(reversal_of_id)
    WHERE reversal_of_id IS NOT NULL;

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY settlements_tenant_isolation ON settlements
    FOR ALL
    USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY settlements_service_role_bypass ON settlements
    FOR ALL
    TO service_role
    USING (true);

CREATE TRIGGER set_settlements_updated_at
    BEFORE UPDATE ON settlements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SETTLEMENT ITEMS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS settlement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),

    -- Snapshot of on-hand. Captured when drafting for display, then overwritten at
    -- post time with the live locked value so the record reflects what was actually
    -- corrected rather than what the UI happened to show.
    system_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
    counted_quantity DECIMAL(15,3) NOT NULL,

    -- Written by post_settlement(); NULL while the document is a draft.
    difference_quantity DECIMAL(15,3),
    value_delta NUMERIC(15,2),

    -- Valuation for an increase, and the fallback cost when FIFO layers run short
    -- on a decrease.
    unit_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
    notes TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT settlement_item_counted_non_negative CHECK (counted_quantity >= 0),
    CONSTRAINT settlement_item_unit_cost_non_negative CHECK (unit_cost >= 0),
    CONSTRAINT settlement_item_unique_per_doc UNIQUE (settlement_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_settlement_items_tenant ON settlement_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settlement_items_settlement ON settlement_items(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_items_item ON settlement_items(tenant_id, item_id);

ALTER TABLE settlement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY settlement_items_tenant_isolation ON settlement_items
    FOR ALL
    USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY settlement_items_service_role_bypass ON settlement_items
    FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- VALUATION LAYER DISCRIMINATOR  (nullable, no backfill)
-- =============================================================================

ALTER TABLE stock_valuation_layers
    ADD COLUMN IF NOT EXISTS source_settlement_id UUID
        REFERENCES settlements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_svl_source_settlement
    ON stock_valuation_layers(source_settlement_id)
    WHERE source_settlement_id IS NOT NULL;

COMMENT ON COLUMN stock_valuation_layers.source_settlement_id IS
    'Set when this layer was created by a posted inventory settlement (stock increase). An opening layer is source_invoice_id IS NULL AND source_settlement_id IS NULL.';

-- =============================================================================
-- SETTLEMENT NUMBER SEQUENCE
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_settlement_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_year_month TEXT;
    v_sequence INT;
BEGIN
    v_year_month := to_char(now(), 'YYYYMM');

    SELECT COALESCE(MAX(
        CAST(SUBSTRING(settlement_number FROM 'ADJ-[0-9]{6}-([0-9]+)') AS INT)
    ), 0) + 1
    INTO v_sequence
    FROM settlements
    WHERE tenant_id = p_tenant_id
      AND settlement_number LIKE 'ADJ-' || v_year_month || '-%';

    RETURN 'ADJ-' || v_year_month || '-' || LPAD(v_sequence::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- =============================================================================
-- ATOMIC POSTING
-- =============================================================================

-- Applies a whole settlement in ONE transaction: locks each inventory row, applies
-- the counted-vs-system delta, keeps FIFO layers in step, and stamps the document.
-- Either every line lands or none does — unlike the other stock paths in this
-- codebase, which are non-transactional and can partially apply. A half-applied
-- physical count would corrupt both on-hand and valuation with no way to tell what
-- landed, so it earns the exception.
--
-- SECURITY INVOKER (default): called with the caller's JWT, so the tenant_isolation
-- policies on settlements / settlement_items / inventory / stock_valuation_layers
-- all apply. p_tenant_id is an explicit belt-and-braces filter.
--
-- The caller posts the journal entry afterwards from the returned net value delta.
CREATE OR REPLACE FUNCTION post_settlement(
    p_settlement_id UUID,
    p_tenant_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_cogs_enabled BOOLEAN DEFAULT true
)
RETURNS TABLE (
    lines_applied INT,
    increase_value NUMERIC,
    decrease_value NUMERIC,
    net_value_delta NUMERIC
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    c_eps CONSTANT NUMERIC := 0.0001;
    v_settlement RECORD;
    v_line RECORD;
    v_layer RECORD;
    v_inv_id UUID;
    v_system NUMERIC;
    v_diff NUMERIC;
    v_new_qty NUMERIC;
    v_outstanding NUMERIC;
    v_take NUMERIC;
    v_line_value NUMERIC;
    v_increase NUMERIC := 0;
    v_decrease NUMERIC := 0;
    v_applied INT := 0;
BEGIN
    SELECT * INTO v_settlement
    FROM settlements
    WHERE id = p_settlement_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SETTLEMENT_NOT_FOUND';
    END IF;

    IF v_settlement.status <> 'draft' THEN
        RAISE EXCEPTION 'SETTLEMENT_NOT_DRAFT';
    END IF;

    FOR v_line IN
        SELECT * FROM settlement_items
        WHERE settlement_id = p_settlement_id AND tenant_id = p_tenant_id
        ORDER BY sort_order, id
    LOOP
        -- Ensure the inventory row exists so it can be locked. Mirrors
        -- InventoryRepository.getOrCreate.
        INSERT INTO inventory (tenant_id, item_id, warehouse_id, quantity, reserved_quantity)
        VALUES (p_tenant_id, v_line.item_id, v_settlement.warehouse_id, 0, 0)
        ON CONFLICT (item_id, warehouse_id) DO NOTHING;

        SELECT id, quantity INTO v_inv_id, v_system
        FROM inventory
        WHERE tenant_id = p_tenant_id
          AND item_id = v_line.item_id
          AND warehouse_id = v_settlement.warehouse_id
        FOR UPDATE;

        v_diff := v_line.counted_quantity - v_system;
        v_line_value := 0;

        -- No-op line: record the observation, change nothing.
        IF abs(v_diff) < c_eps THEN
            UPDATE settlement_items
            SET system_quantity = v_system,
                difference_quantity = 0,
                value_delta = 0
            WHERE id = v_line.id;
            CONTINUE;
        END IF;

        v_new_qty := v_system + v_diff;
        IF v_new_qty < -c_eps THEN
            RAISE EXCEPTION 'SETTLEMENT_NEGATIVE_STOCK:%', v_line.item_id;
        END IF;

        IF p_cogs_enabled THEN
            IF v_diff < 0 THEN
                -- Shortage: relieve FIFO layers oldest-first and value the loss at
                -- the cost actually removed, not at the line's unit_cost.
                v_outstanding := -v_diff;

                FOR v_layer IN
                    SELECT id, qty_remaining, unit_cost
                    FROM stock_valuation_layers
                    WHERE tenant_id = p_tenant_id
                      AND item_id = v_line.item_id
                      AND warehouse_id = v_settlement.warehouse_id
                      AND qty_remaining > 0
                    ORDER BY layer_date ASC, created_at ASC
                    FOR UPDATE
                LOOP
                    EXIT WHEN v_outstanding <= c_eps;

                    v_take := LEAST(v_outstanding, v_layer.qty_remaining);

                    UPDATE stock_valuation_layers
                    SET qty_remaining = qty_remaining - v_take
                    WHERE id = v_layer.id;

                    v_line_value := v_line_value - (v_take * v_layer.unit_cost);
                    v_outstanding := v_outstanding - v_take;
                END LOOP;

                -- Layers ran short (stock existed on-hand without cost backing).
                -- Cost the remainder at the line's unit_cost rather than at zero,
                -- which is what inventory-valuation.service.ts does on sales.
                IF v_outstanding > c_eps THEN
                    v_line_value := v_line_value - (v_outstanding * v_line.unit_cost);
                END IF;
            ELSE
                -- Overage: one new cost lot, marked as settlement-sourced so it is
                -- never mistaken for (or overwritten as) opening stock.
                INSERT INTO stock_valuation_layers (
                    tenant_id, item_id, warehouse_id,
                    qty_in, qty_remaining, unit_cost, layer_date,
                    source_invoice_id, source_invoice_item_id, source_settlement_id
                ) VALUES (
                    p_tenant_id, v_line.item_id, v_settlement.warehouse_id,
                    v_diff, v_diff, v_line.unit_cost,
                    v_settlement.settlement_date::timestamptz,
                    NULL, NULL, p_settlement_id
                );

                v_line_value := v_diff * v_line.unit_cost;
            END IF;
        ELSE
            -- Valuation disabled for this tenant: no layers exist to maintain, so
            -- value the movement at the line cost purely for reporting.
            v_line_value := v_diff * v_line.unit_cost;
        END IF;

        UPDATE inventory
        SET quantity = v_new_qty, updated_at = now()
        WHERE id = v_inv_id;

        UPDATE settlement_items
        SET system_quantity = v_system,
            difference_quantity = v_diff,
            value_delta = round(v_line_value, 2)
        WHERE id = v_line.id;

        IF v_line_value >= 0 THEN
            v_increase := v_increase + v_line_value;
        ELSE
            v_decrease := v_decrease + abs(v_line_value);
        END IF;

        v_applied := v_applied + 1;
    END LOOP;

    IF v_applied = 0 THEN
        RAISE EXCEPTION 'SETTLEMENT_NO_CHANGES';
    END IF;

    UPDATE settlements
    SET status = 'posted',
        posted_at = now(),
        posted_by = p_user_id,
        total_increase_value = round(v_increase, 2),
        total_decrease_value = round(v_decrease, 2),
        updated_at = now()
    WHERE id = p_settlement_id;

    RETURN QUERY SELECT
        v_applied,
        round(v_increase, 2),
        round(v_decrease, 2),
        round(v_increase - v_decrease, 2);
END;
$$;

-- =============================================================================
-- ACCOUNTING DEFAULT ROLE  (strictly widening — cannot invalidate existing rows)
-- =============================================================================

ALTER TABLE accounting_default_accounts
  DROP CONSTRAINT IF EXISTS accounting_default_accounts_role_check;

ALTER TABLE accounting_default_accounts
  ADD CONSTRAINT accounting_default_accounts_role_check
    CHECK (role IN (
      'cash_in_hand',
      'accounts_receivable',
      'accounts_payable',
      'sales_revenue',
      'sales_tax_payable',
      'inventory_asset',
      'cogs',
      'discount_allowed',
      'discount_received',
      'salary_expense',
      'salary_payable',
      'general_expense',
      'service_purchase_expense',
      'opening_balance_equity',
      'inventory_adjustment'
    ));

-- =============================================================================
-- ITEM GRID — exclude settlement layers from the opening-stock aggregate
-- =============================================================================

-- Body-only change: adds `AND svl.source_settlement_id IS NULL` to the opening
-- layer LATERAL. A no-op against all pre-existing rows (they are all NULL).
CREATE OR REPLACE FUNCTION get_item_grid(
    p_tenant_id UUID,
    p_warehouse_id UUID DEFAULT NULL,
    p_search TEXT DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_missing_barcode BOOLEAN DEFAULT false,
    p_missing_retail BOOLEAN DEFAULT false,
    p_missing_cost BOOLEAN DEFAULT false,
    p_zero_opening_qty BOOLEAN DEFAULT false,
    p_missing_opening_cost BOOLEAN DEFAULT false,
    p_include_inactive BOOLEAN DEFAULT false,
    p_item_id UUID DEFAULT NULL,
    p_sort_by TEXT DEFAULT 'name',
    p_sort_dir TEXT DEFAULT 'asc',
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    item_id UUID,
    name TEXT,
    name_alias TEXT,
    sku TEXT,
    barcode TEXT,
    brand TEXT,
    category_id UUID,
    category_name TEXT,
    unit_of_measure TEXT,
    tracks_expiry BOOLEAN,
    expiry_date DATE,
    is_active BOOLEAN,
    retail_price_id UUID,
    retail_price DECIMAL(15,2),
    retail_currency TEXT,
    cost_price_id UUID,
    cost_price DECIMAL(15,2),
    cost_currency TEXT,
    current_qty DECIMAL(15,3),
    has_opening_entry BOOLEAN,
    opening_qty DECIMAL(15,3),
    opening_remaining DECIMAL(15,3),
    opening_sold_qty DECIMAL(15,3),
    opening_unit_cost DECIMAL(15,4),
    total_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
    WITH base AS (
        SELECT
            it.id,
            it.name,
            it.name_alias,
            it.sku,
            it.barcode,
            it.brand,
            it.category_id,
            c.name AS category_name,
            it.unit_of_measure,
            it.tracks_expiry,
            it.expiry_date,
            it.is_active,
            rp.id     AS retail_price_id,
            rp.price  AS retail_price,
            rp.currency AS retail_currency,
            cp.id     AS cost_price_id,
            cp.price  AS cost_price,
            cp.currency AS cost_currency,
            COALESCE(inv.quantity, 0)::DECIMAL(15,3) AS current_qty,
            COALESCE(op.layer_count, 0) > 0          AS has_opening_entry,
            COALESCE(op.qty_in, 0)::DECIMAL(15,3)    AS opening_qty,
            COALESCE(op.qty_remaining, 0)::DECIMAL(15,3) AS opening_remaining,
            GREATEST(
                COALESCE(op.qty_in, 0) - COALESCE(op.qty_remaining, 0),
                0
            )::DECIMAL(15,3) AS opening_sold_qty,
            CASE
                WHEN COALESCE(op.qty_in, 0) > 0
                    THEN (op.total_value / op.qty_in)::DECIMAL(15,4)
                ELSE 0::DECIMAL(15,4)
            END AS opening_unit_cost
        FROM items it
        LEFT JOIN categories c
            ON c.id = it.category_id
        -- Effective retail price (mirrors get_item_price ordering)
        LEFT JOIN LATERAL (
            SELECT ip.id, ip.price, ip.currency
            FROM item_prices ip
            WHERE ip.item_id = it.id
              AND ip.tenant_id = it.tenant_id
              AND ip.price_tier = 'retail'
              AND (ip.effective_from IS NULL OR ip.effective_from <= CURRENT_DATE)
              AND (ip.effective_to IS NULL OR ip.effective_to >= CURRENT_DATE)
            ORDER BY ip.effective_from DESC NULLS LAST
            LIMIT 1
        ) rp ON true
        -- Effective cost price
        LEFT JOIN LATERAL (
            SELECT ip.id, ip.price, ip.currency
            FROM item_prices ip
            WHERE ip.item_id = it.id
              AND ip.tenant_id = it.tenant_id
              AND ip.price_tier = 'cost'
              AND (ip.effective_from IS NULL OR ip.effective_from <= CURRENT_DATE)
              AND (ip.effective_to IS NULL OR ip.effective_to >= CURRENT_DATE)
            ORDER BY ip.effective_from DESC NULLS LAST
            LIMIT 1
        ) cp ON true
        -- On-hand quantity in the selected warehouse
        LEFT JOIN inventory inv
            ON p_warehouse_id IS NOT NULL
           AND inv.item_id = it.id
           AND inv.warehouse_id = p_warehouse_id
           AND inv.tenant_id = it.tenant_id
        -- Opening-stock layers, aggregated the same way opening-stock.service.ts does
        LEFT JOIN LATERAL (
            SELECT
                COUNT(*)                          AS layer_count,
                SUM(svl.qty_in)                   AS qty_in,
                SUM(svl.qty_remaining)            AS qty_remaining,
                SUM(svl.qty_in * svl.unit_cost)   AS total_value
            FROM stock_valuation_layers svl
            WHERE p_warehouse_id IS NOT NULL
              AND svl.tenant_id = it.tenant_id
              AND svl.item_id = it.id
              AND svl.warehouse_id = p_warehouse_id
              AND svl.source_invoice_id IS NULL
              AND svl.source_settlement_id IS NULL
        ) op ON true
        WHERE it.tenant_id = p_tenant_id
          AND (p_include_inactive OR it.is_active = true)
          AND (p_item_id IS NULL OR it.id = p_item_id)
          AND (p_category_id IS NULL OR it.category_id = p_category_id)
          AND (
              p_search IS NULL OR p_search = '' OR
              it.name ILIKE '%' || p_search || '%' OR
              it.name_alias ILIKE '%' || p_search || '%' OR
              it.sku ILIKE '%' || p_search || '%' OR
              it.barcode ILIKE '%' || p_search || '%' OR
              it.brand ILIKE '%' || p_search || '%'
          )
    ),
    filtered AS (
        SELECT * FROM base b
        WHERE (NOT p_missing_barcode OR b.barcode IS NULL OR btrim(b.barcode) = '')
          AND (NOT p_missing_retail  OR b.retail_price IS NULL OR b.retail_price = 0)
          AND (NOT p_missing_cost    OR b.cost_price   IS NULL OR b.cost_price   = 0)
          AND (NOT p_zero_opening_qty     OR b.opening_qty = 0)
          AND (NOT p_missing_opening_cost OR NOT b.has_opening_entry OR b.opening_unit_cost = 0)
    )
    SELECT
        f.id, f.name, f.name_alias, f.sku, f.barcode, f.brand,
        f.category_id, f.category_name, f.unit_of_measure,
        f.tracks_expiry, f.expiry_date, f.is_active,
        f.retail_price_id, f.retail_price, f.retail_currency,
        f.cost_price_id, f.cost_price, f.cost_currency,
        f.current_qty, f.has_opening_entry,
        f.opening_qty, f.opening_remaining, f.opening_sold_qty, f.opening_unit_cost,
        COUNT(*) OVER () AS total_count
    FROM filtered f
    ORDER BY
        CASE WHEN p_sort_dir = 'asc'  AND p_sort_by = 'name'    THEN f.name    END ASC,
        CASE WHEN p_sort_dir = 'desc' AND p_sort_by = 'name'    THEN f.name    END DESC,
        CASE WHEN p_sort_dir = 'asc'  AND p_sort_by = 'sku'     THEN f.sku     END ASC,
        CASE WHEN p_sort_dir = 'desc' AND p_sort_by = 'sku'     THEN f.sku     END DESC,
        CASE WHEN p_sort_dir = 'asc'  AND p_sort_by = 'barcode' THEN f.barcode END ASC,
        CASE WHEN p_sort_dir = 'desc' AND p_sort_by = 'barcode' THEN f.barcode END DESC,
        f.name ASC
    LIMIT p_limit
    OFFSET p_offset;
$$;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE settlements IS
    'Inventory settlement (stock adjustment) documents. Draft -> posted; posting is atomic via post_settlement() and books the net value change to the inventory_adjustment account.';

COMMENT ON TABLE settlement_items IS
    'Settlement lines. system_quantity is the on-hand snapshot, counted_quantity the physical count; difference_quantity and value_delta are written at post time.';

COMMENT ON FUNCTION post_settlement IS
    'Atomically applies a draft settlement: locks each inventory row, applies counted-vs-system deltas, maintains FIFO layers, stamps the document, and returns the value totals for journal posting.';
