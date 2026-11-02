-- Migration: 039_bulk_adjust_item_prices.sql
-- Description: Tenant-wide bulk price adjustment (percentage or fixed amount)
--              for one price tier/currency, optionally scoped to a category.
--              Replaces the per-item read-modify-write loop for the
--              "Change All Prices" action on the items page.
-- Author: ERP SaaS Implementation
-- Date: 2026-11-02

-- =============================================================================
-- BULK ADJUST FUNCTION
-- =============================================================================

-- SECURITY INVOKER (default): the API calls this with the caller's JWT, so the
-- tenant_isolation_* RLS policies on items/item_prices apply. p_tenant_id is an
-- additional explicit filter that also lets the planner use idx_item_prices_tier.
--
-- Only price rows effective today are adjusted (same rule as get_item_grid and
-- ItemRepository.getCurrentPrice). Items with no such row for the tier/currency
-- are reported as skipped; no price is invented for them.
CREATE OR REPLACE FUNCTION bulk_adjust_item_prices(
    p_tenant_id UUID,
    p_adjustment_type TEXT,
    p_adjustment_value NUMERIC,
    p_price_tier TEXT,
    p_currency TEXT,
    p_category_id UUID DEFAULT NULL
)
RETURNS TABLE (
    updated_count INT,
    skipped_count INT
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_scope_count INT;
    v_updated     INT;
BEGIN
    IF p_adjustment_type NOT IN ('percentage', 'fixed') THEN
        RAISE EXCEPTION 'Adjustment type must be "percentage" or "fixed"';
    END IF;

    IF p_adjustment_type = 'percentage'
       AND (p_adjustment_value < -100 OR p_adjustment_value > 1000) THEN
        RAISE EXCEPTION 'Percentage adjustment must be between -100%% and 1000%%';
    END IF;

    SELECT COUNT(*) INTO v_scope_count
    FROM items it
    WHERE it.tenant_id = p_tenant_id
      AND (p_category_id IS NULL OR it.category_id = p_category_id);

    WITH updated AS (
        UPDATE item_prices ip
        SET price = GREATEST(
                0,
                ROUND(
                    CASE
                        WHEN p_adjustment_type = 'percentage'
                            THEN ip.price * (1 + p_adjustment_value / 100)
                        ELSE ip.price + p_adjustment_value
                    END,
                    2
                )
            )
        FROM items it
        WHERE it.id = ip.item_id
          AND it.tenant_id = p_tenant_id
          AND (p_category_id IS NULL OR it.category_id = p_category_id)
          AND ip.tenant_id = p_tenant_id
          AND ip.price_tier = p_price_tier
          AND ip.currency = p_currency
          AND (ip.effective_from IS NULL OR ip.effective_from <= CURRENT_DATE)
          AND (ip.effective_to IS NULL OR ip.effective_to >= CURRENT_DATE)
        RETURNING ip.item_id
    )
    SELECT COUNT(DISTINCT u.item_id) INTO v_updated FROM updated u;

    updated_count := v_updated;
    skipped_count := v_scope_count - v_updated;
    RETURN NEXT;
END;
$$;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION bulk_adjust_item_prices(UUID, TEXT, NUMERIC, TEXT, TEXT, UUID) IS
    'Adjusts the currently effective price of every item in scope (tenant, optional category) for one tier/currency by a percentage or fixed amount, floored at 0. Returns updated and skipped item counts.';
