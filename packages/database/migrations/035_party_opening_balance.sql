-- Migration: 035_party_opening_balance.sql
-- Description: Add opening balances for customers and suppliers, and make the
--              party balance RPCs opening-aware
-- Author: ERP SaaS Implementation
-- Date: 2026-08-01
--
-- Sign convention: parties.balance is "outstanding in the party's natural
-- direction" -- the triggers in 007_parties_schema.sql add invoice totals and
-- subtract payments for BOTH party types. So:
--     customer, balance > 0  ->  they owe us      (Debit side of the ledger)
--     supplier, balance > 0  ->  we owe them      (Credit side of the ledger)
-- opening_balance uses that exact same convention, which is why it can simply
-- be added to the running balance with no per-type branching.

-- =============================================================================
-- PARTIES TABLE: OPENING BALANCE COLUMNS
-- =============================================================================

ALTER TABLE parties ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS opening_balance_date DATE;

DO $$ BEGIN
    ALTER TABLE parties ADD CONSTRAINT parties_opening_balance_requires_date
        CHECK (opening_balance = 0 OR opening_balance_date IS NOT NULL);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- No index: opening balances are only ever read by primary key or as part of a
-- full-tenant scan already served by idx_parties_tenant / idx_parties_tenant_type.

-- =============================================================================
-- ATOMIC OPENING BALANCE SETTER
-- =============================================================================
-- Sets the opening balance and folds the difference into the running balance in
-- a single statement, under a row lock. Returns the delta so the API can post a
-- matching adjusting journal entry.
--
-- This is deliberately delta-based rather than read-modify-write: the running
-- balance is concurrently mutated by the invoice/payment triggers, so reading it
-- in the app and writing back a total would lose those updates.

CREATE OR REPLACE FUNCTION set_party_opening_balance(
    p_tenant_id UUID,
    p_party_id  UUID,
    p_amount    DECIMAL(15,2),
    p_date      DATE
)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    v_old   DECIMAL(15,2);
    v_new   DECIMAL(15,2);
    v_delta DECIMAL(15,2);
BEGIN
    v_new := COALESCE(p_amount, 0);

    -- Row lock serialises concurrent edits to the same party.
    SELECT COALESCE(opening_balance, 0)
    INTO v_old
    FROM parties
    WHERE id = p_party_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Party % not found for tenant %', p_party_id, p_tenant_id
            USING ERRCODE = 'no_data_found';
    END IF;

    v_delta := v_new - v_old;

    UPDATE parties
    SET opening_balance      = v_new,
        opening_balance_date = CASE WHEN v_new = 0 THEN NULL ELSE p_date END,
        balance              = balance + v_delta,
        updated_at           = NOW()
    WHERE id = p_party_id AND tenant_id = p_tenant_id;

    RETURN v_delta;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- BALANCE CALCULATION (now opening-aware)
-- =============================================================================
-- Redefined from 019_restore_party_rpcs.sql to include the opening balance.
-- Without this, the "Recalculate balance" action would overwrite parties.balance
-- with an invoice/payment-only total and silently erase every opening balance.

CREATE OR REPLACE FUNCTION calculate_party_balance(p_party_id UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    v_opening       DECIMAL(15,2);
    v_invoice_total DECIMAL(15,2);
    v_payment_total DECIMAL(15,2);
BEGIN
    -- Opening balance carried in from before the system was adopted
    SELECT COALESCE(opening_balance, 0)
    INTO v_opening
    FROM parties
    WHERE id = p_party_id;

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

    RETURN COALESCE(v_opening, 0) + v_invoice_total - v_payment_total;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- BALANCE RECALCULATION (writes back to parties.balance)
-- =============================================================================
-- Body is unchanged from 019, re-emitted here so it is self-evident that
-- recalculation is now opening-aware by virtue of calculate_party_balance above.

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
-- BALANCE SUMMARY (adds opening_balance to the result set)
-- =============================================================================
-- CREATE OR REPLACE cannot change a RETURNS TABLE column list, so the old
-- signature must be dropped first.

DROP FUNCTION IF EXISTS get_party_balance_summary(UUID, party_type);

CREATE OR REPLACE FUNCTION get_party_balance_summary(p_tenant_id UUID, p_party_type party_type DEFAULT NULL)
RETURNS TABLE (
    party_id UUID,
    party_name TEXT,
    party_type party_type,
    opening_balance DECIMAL(15,2),
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
        COALESCE(p.opening_balance, 0) AS opening_balance,
        COALESCE(SUM(CASE WHEN i.status = 'final' THEN i.total * i.exchange_rate ELSE 0 END), 0) AS total_invoiced,
        COALESCE(SUM(pay.amount * pay.exchange_rate), 0) AS total_paid,
        p.balance AS current_balance
    FROM parties p
    LEFT JOIN invoices i ON i.party_id = p.id AND i.tenant_id = p.tenant_id
    LEFT JOIN payments pay ON pay.party_id = p.id AND pay.tenant_id = p.tenant_id
    WHERE p.tenant_id = p_tenant_id
      AND (p_party_type IS NULL OR p.type = p_party_type)
    GROUP BY p.id, p.name, p.type, p.opening_balance, p.balance
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- NOTE ON EXISTING TRIGGERS
-- =============================================================================
-- update_party_balance_on_payment, reverse_party_balance_on_payment_delete and
-- update_party_balance_on_invoice_finalize (all 007_parties_schema.sql) adjust
-- parties.balance by a delta and never overwrite it, so the opening balance
-- seeded by set_party_opening_balance survives all of them untouched. No trigger
-- changes are required by this migration.

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN parties.opening_balance IS 'Balance carried in from before the system was adopted, signed in the party''s natural direction (customer: positive = owes us; supplier: positive = we owe them)';
COMMENT ON COLUMN parties.opening_balance_date IS 'Date the opening balance was outstanding as of; required whenever opening_balance is non-zero';
COMMENT ON FUNCTION set_party_opening_balance IS 'Atomically set a party opening balance and fold the difference into parties.balance; returns the delta applied';
COMMENT ON FUNCTION calculate_party_balance IS 'Derived party balance: opening balance + finalized invoices - payments';
COMMENT ON FUNCTION recalculate_party_balance IS 'Recompute parties.balance from calculate_party_balance (opening-aware) and persist it';
COMMENT ON FUNCTION get_party_balance_summary IS 'Per-party opening balance, invoiced/paid totals and current balance for a tenant';
