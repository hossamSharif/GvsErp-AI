-- Migration 024: Inventory valuation layers + COGS support
-- Phase 5 of the Tally-parity plan.
--
-- Adds FIFO inventory layers so every sale can compute and post Cost of
-- Goods Sold at real historical cost (instead of being implied by the
-- difference between revenue and inventory movement). Quarantined behind a
-- per-tenant feature flag — tenants.settings.modules.accounting.cogs_enabled.
--
-- Tax-split is explicitly out of scope per the user's plan choice; tax
-- stays bundled with inventory on purchase JEs.
--
-- Dependencies: 003_items_schema.sql, 004_invoices_schema.sql,
--               011_accounting_schema.sql,
--               021_accounting_defaults_and_idempotency.sql

-- =============================================================================
-- items.valuation_method + avg_cost (forward-compatible metadata)
-- =============================================================================

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS valuation_method TEXT NOT NULL DEFAULT 'fifo',
  ADD COLUMN IF NOT EXISTS avg_cost DECIMAL(15,4);

ALTER TABLE items
  DROP CONSTRAINT IF EXISTS items_valuation_method_check;
ALTER TABLE items
  ADD CONSTRAINT items_valuation_method_check
  CHECK (valuation_method IN ('fifo', 'weighted_average'));

COMMENT ON COLUMN items.valuation_method IS
  'Phase 5: how COGS is computed for this item. v1 only implements fifo; weighted_average is reserved for a follow-up.';
COMMENT ON COLUMN items.avg_cost IS
  'Reserved for weighted-average valuation (future). FIFO ignores this column.';

-- =============================================================================
-- stock_valuation_layers — append-only ledger of inventory cost lots
-- =============================================================================
--
-- One row per purchase line. Sales consume the oldest layers first (FIFO)
-- by decrementing qty_remaining. A layer with qty_remaining = 0 is fully
-- consumed but kept for traceability.

CREATE TABLE IF NOT EXISTS stock_valuation_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  qty_in DECIMAL(15,3) NOT NULL,
  qty_remaining DECIMAL(15,3) NOT NULL,
  unit_cost DECIMAL(15,4) NOT NULL,
  layer_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_invoice_id UUID REFERENCES invoices(id) ON DELETE RESTRICT,
  source_invoice_item_id UUID REFERENCES invoice_items(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT svl_qty_in_positive CHECK (qty_in > 0),
  CONSTRAINT svl_qty_remaining_valid CHECK (qty_remaining >= 0 AND qty_remaining <= qty_in),
  CONSTRAINT svl_unit_cost_non_negative CHECK (unit_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_svl_tenant ON stock_valuation_layers(tenant_id);
-- Hot path: oldest-first layer pull per item+warehouse with remaining stock.
CREATE INDEX IF NOT EXISTS idx_svl_consume
  ON stock_valuation_layers(tenant_id, item_id, warehouse_id, layer_date)
  WHERE qty_remaining > 0;
CREATE INDEX IF NOT EXISTS idx_svl_source_invoice
  ON stock_valuation_layers(source_invoice_id)
  WHERE source_invoice_id IS NOT NULL;

ALTER TABLE stock_valuation_layers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_stock_valuation_layers ON stock_valuation_layers
  FOR ALL
  USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY service_role_bypass_stock_valuation_layers ON stock_valuation_layers
  FOR ALL
  TO service_role
  USING (true);

COMMENT ON TABLE stock_valuation_layers IS
  'Phase 5: FIFO cost lots. One row per purchase line; sales consume oldest-first via qty_remaining decrement. Append-only — never delete.';

-- =============================================================================
-- invoice_items.cogs_amount — COGS computed on sale finalize
-- =============================================================================

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS cogs_amount DECIMAL(15,2);

COMMENT ON COLUMN invoice_items.cogs_amount IS
  'Phase 5: cost of goods sold for this sale line, computed at finalize-time by consuming FIFO layers. NULL for pre-Phase-5 lines and for purchase lines.';
