-- Migration: 004_invoices_schema
-- Description: Create Invoice and InvoiceItem tables for sales and purchases
-- Depends on: 001_core_schema (tenants, users), 003_items_schema (items)

-- =============================================================================
-- INVOICE TYPE ENUM
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE invoice_type AS ENUM ('sale', 'purchase');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM ('draft', 'final', 'returned', 'canceled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- INVOICE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    type invoice_type NOT NULL,
    status invoice_status NOT NULL DEFAULT 'draft',
    party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total DECIMAL(15,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate DECIMAL(15,6) NOT NULL DEFAULT 1,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    returned_from_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalized_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT invoices_subtotal_positive CHECK (subtotal >= 0),
    CONSTRAINT invoices_tax_positive CHECK (tax_amount >= 0),
    CONSTRAINT invoices_discount_positive CHECK (discount_amount >= 0),
    CONSTRAINT invoices_total_positive CHECK (total >= 0),
    CONSTRAINT invoices_exchange_rate_positive CHECK (exchange_rate > 0)
);

-- Indexes for invoices
CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE UNIQUE INDEX idx_invoices_number_unique ON invoices(tenant_id, invoice_number);
CREATE INDEX idx_invoices_party ON invoices(tenant_id, party_id);
CREATE INDEX idx_invoices_warehouse ON invoices(tenant_id, warehouse_id);
CREATE INDEX idx_invoices_type ON invoices(tenant_id, type);
CREATE INDEX idx_invoices_status ON invoices(tenant_id, status);
CREATE INDEX idx_invoices_created_at ON invoices(tenant_id, created_at);
CREATE INDEX idx_invoices_finalized_at ON invoices(tenant_id, finalized_at);
CREATE INDEX idx_invoices_returned_from ON invoices(returned_from_id) WHERE returned_from_id IS NOT NULL;

-- RLS for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_invoices ON invoices
    FOR ALL
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE POLICY service_role_bypass_invoices ON invoices
    FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- INVOICE ITEM TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    description TEXT,
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT invoice_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT invoice_items_unit_price_positive CHECK (unit_price >= 0),
    CONSTRAINT invoice_items_discount_range CHECK (discount_percent >= 0 AND discount_percent <= 100),
    CONSTRAINT invoice_items_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 100),
    CONSTRAINT invoice_items_line_total_positive CHECK (line_total >= 0)
);

-- Indexes for invoice_items
CREATE INDEX idx_invoice_items_tenant ON invoice_items(tenant_id);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_item ON invoice_items(item_id);
CREATE INDEX idx_invoice_items_sort ON invoice_items(invoice_id, sort_order);

-- RLS for invoice_items
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_invoice_items ON invoice_items
    FOR ALL
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE POLICY service_role_bypass_invoice_items ON invoice_items
    FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at for invoices
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_invoices_updated_at ON invoices;
CREATE TRIGGER trigger_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_invoices_updated_at();

-- Set finalized_at when status changes to 'final'
CREATE OR REPLACE FUNCTION set_invoice_finalized_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'final' AND OLD.status != 'final' THEN
        NEW.finalized_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_invoice_finalized_at ON invoices;
CREATE TRIGGER trigger_set_invoice_finalized_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION set_invoice_finalized_at();

-- =============================================================================
-- INVOICE NUMBER SEQUENCE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoice_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type invoice_type NOT NULL,
    year_month TEXT NOT NULL, -- Format: YYYYMM
    last_number INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT invoice_sequences_unique UNIQUE (tenant_id, type, year_month)
);

-- RLS for invoice_sequences
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_invoice_sequences ON invoice_sequences
    FOR ALL
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE POLICY service_role_bypass_invoice_sequences ON invoice_sequences
    FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to generate next invoice number
-- Format: SAL-YYYYMM-XXXX or PUR-YYYYMM-XXXX
CREATE OR REPLACE FUNCTION generate_invoice_number(
    p_tenant_id UUID,
    p_type invoice_type
)
RETURNS TEXT AS $$
DECLARE
    v_year_month TEXT;
    v_prefix TEXT;
    v_next_number INTEGER;
    v_invoice_number TEXT;
BEGIN
    -- Get current year/month
    v_year_month := to_char(now(), 'YYYYMM');

    -- Set prefix based on type
    IF p_type = 'sale' THEN
        v_prefix := 'SAL';
    ELSE
        v_prefix := 'PUR';
    END IF;

    -- Get and increment sequence (with locking)
    INSERT INTO invoice_sequences (tenant_id, type, year_month, last_number)
    VALUES (p_tenant_id, p_type, v_year_month, 1)
    ON CONFLICT (tenant_id, type, year_month)
    DO UPDATE SET
        last_number = invoice_sequences.last_number + 1,
        updated_at = now()
    RETURNING last_number INTO v_next_number;

    -- Format: SAL-202512-0001
    v_invoice_number := v_prefix || '-' || v_year_month || '-' || lpad(v_next_number::text, 4, '0');

    RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate invoice line total
-- line_total = quantity * unit_price * (1 - discount_percent/100) * (1 + tax_rate/100)
CREATE OR REPLACE FUNCTION calculate_line_total(
    p_quantity DECIMAL(15,3),
    p_unit_price DECIMAL(15,2),
    p_discount_percent DECIMAL(5,2),
    p_tax_rate DECIMAL(5,2)
)
RETURNS DECIMAL(15,2) AS $$
BEGIN
    RETURN ROUND(
        p_quantity * p_unit_price * (1 - p_discount_percent / 100) * (1 + p_tax_rate / 100),
        2
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to recalculate invoice totals from line items
CREATE OR REPLACE FUNCTION recalculate_invoice_totals(p_invoice_id UUID)
RETURNS void AS $$
DECLARE
    v_subtotal DECIMAL(15,2);
    v_tax_amount DECIMAL(15,2);
BEGIN
    -- Calculate subtotal (sum of line totals before tax)
    SELECT
        COALESCE(SUM(quantity * unit_price * (1 - discount_percent / 100)), 0),
        COALESCE(SUM(quantity * unit_price * (1 - discount_percent / 100) * tax_rate / 100), 0)
    INTO v_subtotal, v_tax_amount
    FROM invoice_items
    WHERE invoice_id = p_invoice_id;

    -- Update invoice totals
    UPDATE invoices
    SET
        subtotal = v_subtotal,
        tax_amount = v_tax_amount,
        total = v_subtotal + v_tax_amount - discount_amount
    WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate line_total on invoice_items insert/update
CREATE OR REPLACE FUNCTION calculate_invoice_item_line_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.line_total := calculate_line_total(
        NEW.quantity,
        NEW.unit_price,
        NEW.discount_percent,
        NEW.tax_rate
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_invoice_item_line_total ON invoice_items;
CREATE TRIGGER trigger_calculate_invoice_item_line_total
    BEFORE INSERT OR UPDATE ON invoice_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_invoice_item_line_total();

-- Trigger to recalculate invoice totals when items change
CREATE OR REPLACE FUNCTION trigger_recalculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM recalculate_invoice_totals(OLD.invoice_id);
        RETURN OLD;
    ELSE
        PERFORM recalculate_invoice_totals(NEW.invoice_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_invoice_items_totals ON invoice_items;
CREATE TRIGGER trigger_invoice_items_totals
    AFTER INSERT OR UPDATE OR DELETE ON invoice_items
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_invoice_totals();
