-- Restore party RPC functions defined in 007_parties_schema.sql but missing from
-- the live database. The originals were either never applied or dropped along
-- with a related object. Re-creating them is idempotent (CREATE OR REPLACE).
--
-- Functions (bodies copied verbatim from 007_parties_schema.sql):
--   get_party_balance_summary(p_tenant_id, p_party_type)
--   calculate_party_balance(p_party_id)
--   recalculate_party_balance(p_party_id)

-- =============================================================================
-- BALANCE SUMMARY (per tenant, optionally filtered by party type)
-- =============================================================================

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

-- =============================================================================
-- BALANCE CALCULATION
-- =============================================================================

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

-- =============================================================================
-- BALANCE RECALCULATION (writes back to parties.balance)
-- =============================================================================

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
