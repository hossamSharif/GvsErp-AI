-- Migration: 007_parties_schema
-- Description: Create Party and Payment tables for customer/supplier management
-- Depends on: 001_core_schema (tenants, users), 004_invoices_schema (invoices)

-- =============================================================================
-- PARTY TYPE ENUM
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE party_type AS ENUM ('customer', 'supplier');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_type AS ENUM ('received', 'made');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- PARTY TABLE (Customers & Suppliers)
-- =============================================================================

CREATE TABLE IF NOT EXISTS parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type party_type NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    tax_number TEXT,
    balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT parties_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 255),
    CONSTRAINT parties_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for parties
CREATE INDEX IF NOT EXISTS idx_parties_tenant ON parties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_parties_balance ON parties(tenant_id, balance) WHERE balance != 0;
CREATE INDEX IF NOT EXISTS idx_parties_active ON parties(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_parties_email ON parties(tenant_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parties_phone ON parties(tenant_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parties_created_at ON parties(tenant_id, created_at);

-- RLS for parties
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_parties ON parties;
CREATE POLICY tenant_isolation_parties ON parties
    FOR ALL
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

DROP POLICY IF EXISTS service_role_bypass_parties ON parties;
CREATE POLICY service_role_bypass_parties ON parties
    FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- PAYMENT TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    type payment_type NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate DECIMAL(15,6) NOT NULL DEFAULT 1,
    payment_method TEXT,
    reference TEXT,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    notes TEXT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT payments_amount_positive CHECK (amount > 0),
    CONSTRAINT payments_exchange_rate_positive CHECK (exchange_rate > 0),
    CONSTRAINT payments_currency_format CHECK (char_length(currency) = 3)
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(tenant_id, party_id);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(tenant_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(tenant_id, payment_method) WHERE payment_method IS NOT NULL;

-- RLS for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_payments ON payments;
CREATE POLICY tenant_isolation_payments ON payments
    FOR ALL
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

DROP POLICY IF EXISTS service_role_bypass_payments ON payments;
CREATE POLICY service_role_bypass_payments ON payments
    FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at for parties
CREATE OR REPLACE FUNCTION update_parties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_parties_updated_at ON parties;
CREATE TRIGGER trigger_parties_updated_at
    BEFORE UPDATE ON parties
    FOR EACH ROW
    EXECUTE FUNCTION update_parties_updated_at();

-- =============================================================================
-- BALANCE MANAGEMENT FUNCTIONS
-- =============================================================================

-- Function to update party balance when payment is recorded
-- For customers (type='customer'):
--   - Payment received: balance decreases (they owe less)
-- For suppliers (type='supplier'):
--   - Payment made: balance decreases (we owe less)
CREATE OR REPLACE FUNCTION update_party_balance_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_party_type party_type;
    v_balance_change DECIMAL(15,2);
BEGIN
    -- Get party type
    SELECT type INTO v_party_type FROM parties WHERE id = NEW.party_id;

    -- Calculate balance change (payments always reduce balance)
    -- Convert to base currency if needed
    v_balance_change := NEW.amount * NEW.exchange_rate;

    -- Update party balance (decrease)
    UPDATE parties
    SET balance = balance - v_balance_change
    WHERE id = NEW.party_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_party_balance_on_payment ON payments;
CREATE TRIGGER trigger_update_party_balance_on_payment
    AFTER INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_party_balance_on_payment();

-- Function to reverse party balance when payment is deleted
CREATE OR REPLACE FUNCTION reverse_party_balance_on_payment_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_balance_change DECIMAL(15,2);
BEGIN
    -- Calculate balance change to reverse
    v_balance_change := OLD.amount * OLD.exchange_rate;

    -- Reverse the balance change (increase balance back)
    UPDATE parties
    SET balance = balance + v_balance_change
    WHERE id = OLD.party_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reverse_party_balance_on_payment_delete ON payments;
CREATE TRIGGER trigger_reverse_party_balance_on_payment_delete
    BEFORE DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION reverse_party_balance_on_payment_delete();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get party balance summary
CREATE OR REPLACE FUNCTION get_party_balance_summary(p_tenant_id UUID, p_party_type party_type DEFAULT NULL)
RETURNS TABLE (
    party_id UUID,
    party_name TEXT,
    party_type party_type,
    total_invoiced DECIMAL(15,2),
    total_paid DECIMAL(15,2),
    current_balance DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS party_id,
        p.name AS party_name,
        p.type AS party_type,
        COALESCE(SUM(CASE WHEN i.status = 'final' THEN i.total * i.exchange_rate ELSE 0 END), 0) AS total_invoiced,
        COALESCE(SUM(pay.amount * pay.exchange_rate), 0) AS total_paid,
        p.balance AS current_balance
    FROM parties p
    LEFT JOIN invoices i ON i.party_id = p.id AND i.tenant_id = p.tenant_id
    LEFT JOIN payments pay ON pay.party_id = p.id AND pay.tenant_id = p.tenant_id
    WHERE p.tenant_id = p_tenant_id
      AND (p_party_type IS NULL OR p.type = p_party_type)
    GROUP BY p.id, p.name, p.type, p.balance
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate party balance from transactions (for reconciliation)
CREATE OR REPLACE FUNCTION calculate_party_balance(p_party_id UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    v_invoice_total DECIMAL(15,2);
    v_payment_total DECIMAL(15,2);
    v_party_type party_type;
BEGIN
    -- Get party type
    SELECT type INTO v_party_type FROM parties WHERE id = p_party_id;

    -- Calculate total from finalized invoices
    SELECT COALESCE(SUM(total * exchange_rate), 0)
    INTO v_invoice_total
    FROM invoices
    WHERE party_id = p_party_id
      AND status = 'final';

    -- Calculate total payments
    SELECT COALESCE(SUM(amount * exchange_rate), 0)
    INTO v_payment_total
    FROM payments
    WHERE party_id = p_party_id;

    -- Return balance (invoiced - paid)
    RETURN v_invoice_total - v_payment_total;
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate and fix party balance
CREATE OR REPLACE FUNCTION recalculate_party_balance(p_party_id UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    v_calculated_balance DECIMAL(15,2);
BEGIN
    v_calculated_balance := calculate_party_balance(p_party_id);

    UPDATE parties
    SET balance = v_calculated_balance
    WHERE id = p_party_id;

    RETURN v_calculated_balance;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- INVOICE INTEGRATION
-- =============================================================================

-- Function to update party balance when invoice is finalized
-- This should be called when invoice status changes to 'final'
CREATE OR REPLACE FUNCTION update_party_balance_on_invoice_finalize()
RETURNS TRIGGER AS $$
DECLARE
    v_balance_change DECIMAL(15,2);
BEGIN
    -- Only trigger when status changes to 'final'
    IF NEW.status = 'final' AND (OLD.status IS NULL OR OLD.status != 'final') THEN
        IF NEW.party_id IS NOT NULL THEN
            -- Calculate balance change in base currency
            v_balance_change := NEW.total * NEW.exchange_rate;

            -- Update party balance (increase for finalized invoice)
            UPDATE parties
            SET balance = balance + v_balance_change
            WHERE id = NEW.party_id;
        END IF;
    END IF;

    -- Handle returns (when status changes to 'returned')
    IF NEW.status = 'returned' AND OLD.status = 'final' THEN
        IF NEW.party_id IS NOT NULL THEN
            -- Reverse the balance change
            v_balance_change := NEW.total * NEW.exchange_rate;

            UPDATE parties
            SET balance = balance - v_balance_change
            WHERE id = NEW.party_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_party_balance_on_invoice ON invoices;
CREATE TRIGGER trigger_update_party_balance_on_invoice
    AFTER UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_party_balance_on_invoice_finalize();

-- =============================================================================
-- PAYMENT SEQUENCE (for reference numbers)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type payment_type NOT NULL,
    year_month TEXT NOT NULL, -- Format: YYYYMM
    last_number INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT payment_sequences_unique UNIQUE (tenant_id, type, year_month)
);

-- RLS for payment_sequences
ALTER TABLE payment_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_payment_sequences ON payment_sequences;
CREATE POLICY tenant_isolation_payment_sequences ON payment_sequences
    FOR ALL
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

DROP POLICY IF EXISTS service_role_bypass_payment_sequences ON payment_sequences;
CREATE POLICY service_role_bypass_payment_sequences ON payment_sequences
    FOR ALL
    TO service_role
    USING (true);

-- Function to generate payment reference number
-- Format: RCV-YYYYMM-XXXX or PAY-YYYYMM-XXXX
CREATE OR REPLACE FUNCTION generate_payment_reference(
    p_tenant_id UUID,
    p_type payment_type
)
RETURNS TEXT AS $$
DECLARE
    v_year_month TEXT;
    v_prefix TEXT;
    v_next_number INTEGER;
    v_reference TEXT;
BEGIN
    -- Get current year/month
    v_year_month := to_char(now(), 'YYYYMM');

    -- Set prefix based on type
    IF p_type = 'received' THEN
        v_prefix := 'RCV';
    ELSE
        v_prefix := 'PAY';
    END IF;

    -- Get and increment sequence (with locking)
    INSERT INTO payment_sequences (tenant_id, type, year_month, last_number)
    VALUES (p_tenant_id, p_type, v_year_month, 1)
    ON CONFLICT (tenant_id, type, year_month)
    DO UPDATE SET
        last_number = payment_sequences.last_number + 1,
        updated_at = now()
    RETURNING last_number INTO v_next_number;

    -- Format: RCV-202512-0001
    v_reference := v_prefix || '-' || v_year_month || '-' || lpad(v_next_number::text, 4, '0');

    RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Deferred foreign keys for invoices (see 004_invoices_schema.sql).
-- invoices is created in 004, before warehouses (005) and parties (this file),
-- so its FKs are added here. Constraint names match Postgres' defaults, so the
-- resulting schema is identical to databases where 004 created them inline.
-- Guarded, so this is a no-op on databases that already have them.
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_party_id_fkey') THEN
        ALTER TABLE invoices
            ADD CONSTRAINT invoices_party_id_fkey
            FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_warehouse_id_fkey') THEN
        ALTER TABLE invoices
            ADD CONSTRAINT invoices_warehouse_id_fkey
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT;
    END IF;
END $$;
