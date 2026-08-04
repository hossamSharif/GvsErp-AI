-- Migration: 036_item_grid.sql
-- Description: Merged read for the items bulk-edit grid — item main info + retail/cost
--              price + warehouse opening stock in a single paginated, filterable query.
-- Author: ERP SaaS Implementation
-- Date: 2026-08-04

-- =============================================================================
-- SUPPORTING INDEX
-- =============================================================================

-- The grid joins opening layers (source_invoice_id IS NULL) per item/warehouse on
-- every page load. idx_svl_consume only covers rows with qty_remaining > 0, so a
-- fully-sold opening layer would fall back to a scan.
CREATE INDEX IF NOT EXISTS idx_svl_opening
    ON stock_valuation_layers(tenant_id, warehouse_id, item_id)
    WHERE source_invoice_id IS NULL;

-- =============================================================================
-- ITEM GRID FUNCTION
-- =============================================================================

-- SECURITY INVOKER (default): the API calls this with the caller's JWT, so the
-- tenant_isolation_* RLS policies on items/item_prices/inventory/
-- stock_valuation_layers apply. p_tenant_id is an additional explicit filter that
-- also lets the planner use the tenant-scoped indexes.
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

COMMENT ON FUNCTION get_item_grid IS
    'Merged item / retail price / cost price / warehouse opening-stock rows for the items bulk-edit grid. Supports search, category and "missing data" filters, and server-side pagination via the total_count window.';
