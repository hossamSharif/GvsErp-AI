-- Migration: 038_party_balance_integrity.sql
-- Description: Make the party balance RPCs return-aware and free of the
--              cartesian product in get_party_balance_summary, and add an
--              atomic tenant-scoped balance adjuster for the app-side paths
-- Author: ERP SaaS Implementation
-- Date: 2026-08-16
--
-- Sign convention is unchanged from 035_party_opening_balance.sql:
-- parties.balance is "outstanding in the party's natural direction", invoices
-- add and payments subtract for BOTH party types.
--
-- WHAT CHANGES AND WHY
--
-- 1. calculate_party_balance ignored return invoices. InvoiceService.createReturn
--    inserts a separate row with status='returned' and returned_from_id set, and
--    subtracts its total from parties.balance in app code. Because the function
--    summed only status='final', pressing "Recalculate balance" on a party with
--    a return silently ADDED the returned amount back.
--
-- 2. get_party_balance_summary joined invoices AND payments and then aggregated,
--    so with N invoices and M payments total_invoiced came back multiplied by M
--    and total_paid by N. Replaced with LATERAL scalar aggregates.
--
-- 3. adjust_party_balance is new. InvoiceService.updatePartyBalance and
--    PartyRepository.adjustBalance did a read-modify-write with no row lock and
--    no tenant_id predicate, racing against the triggers that write the same
--    column. Same reasoning as set_party_opening_balance in 035.
--
-- WHAT DELIBERATELY DOES NOT CHANGE
--
-- * opening_balance_date does NOT gate which invoices/payments are counted. It
--   only decides where the opening line sits in a statement (brought forward vs
--   an in-period row). The incremental triggers count every transaction
--   regardless of date, so gating here would make "Recalculate balance"
--   permanently disagree with the trigger-maintained value.
--
-- * No AFTER INSERT and no AFTER DELETE trigger on invoices. Both would double
--   count against the app-side compensation that already exists:
--   InvoiceService.createReturn inserts a status='returned' row AND subtracts
--   its total, and InvoiceService.deleteInvoice subtracts explicitly precisely
--   because no DELETE trigger exists. Moving those two paths into triggers is a
--   separate refactor that must remove the app-side calls in the same commit.
--   Do not add these triggers on their own.
--
-- * This migration does NOT touch any row of parties.balance. See the audit
--   query at the bottom for the repair procedure.

-- =============================================================================
-- BALANCE CALCULATION (return-aware)
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_party_balance(p_party_id UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    v_opening  DECIMAL(15,2);
    v_final    DECIMAL(15,2);
    v_returned DECIMAL(15,2);
    v_paid     DECIMAL(15,2);
BEGIN
    -- Opening balance carried in from before the system was adopted.
    SELECT COALESCE(opening_balance, 0)
    INTO v_opening
    FROM parties
    WHERE id = p_party_id;

    SELECT COALESCE(SUM(total * exchange_rate), 0)
    INTO v_final
    FROM invoices
    WHERE party_id = p_party_id
      AND status = 'final';

    -- Return rows created by InvoiceService.createReturn: a separate invoice
    -- linked back via returned_from_id, whose total was subtracted from
    -- parties.balance at creation time. Rows whose status was flipped
    -- final -> returned in place are excluded on purpose: the trigger in
    -- 007_parties_schema.sql already netted those to zero, and they have
    -- dropped out of v_final along the way.
    SELECT COALESCE(SUM(total * exchange_rate), 0)
    INTO v_returned
    FROM invoices
    WHERE party_id = p_party_id
      AND status = 'returned'
      AND returned_from_id IS NOT NULL;

    SELECT COALESCE(SUM(amount * exchange_rate), 0)
    INTO v_paid
    FROM payments
    WHERE party_id = p_party_id;

    RETURN COALESCE(v_opening, 0) + v_final - v_returned - v_paid;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_party_balance(UUID) IS
    'Recomputes a party balance from scratch: opening_balance + finalized '
    'invoices - return invoices - payments. opening_balance_date deliberately '
    'does NOT filter the sums; it only positions the opening line in a '
    'statement. Changing that would desync this from the incremental triggers.';

-- Unchanged from 035, re-emitted so the pair reads together.
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
-- ATOMIC BALANCE ADJUSTER
-- =============================================================================
-- Single-statement delta update, so it cannot lose a concurrent trigger write
-- the way a read-modify-write in the app can. Tenant-scoped, unlike the
-- triggers, because the callers are app code holding a tenant context.

CREATE OR REPLACE FUNCTION adjust_party_balance(
    p_tenant_id UUID,
    p_party_id  UUID,
    p_delta     DECIMAL(15,2)
)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    v_new DECIMAL(15,2);
BEGIN
    UPDATE parties
    SET balance    = balance + COALESCE(p_delta, 0),
        updated_at = NOW()
    WHERE id = p_party_id AND tenant_id = p_tenant_id
    RETURNING balance INTO v_new;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Party % not found for tenant %', p_party_id, p_tenant_id
            USING ERRCODE = 'no_data_found';
    END IF;

    RETURN v_new;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION adjust_party_balance(UUID, UUID, DECIMAL) IS
    'Applies a signed delta to parties.balance atomically and tenant-scoped. '
    'Use this instead of reading the balance and writing back a total.';

-- =============================================================================
-- BALANCE SUMMARY (cartesian product removed)
-- =============================================================================
-- The return type gains total_returned, so the old function has to be dropped
-- rather than replaced. PartyService.getBalanceSummary must ship in the same
-- release: reading a column the RPC no longer returns is exactly how every
-- summary once reported a zero balance.

DROP FUNCTION IF EXISTS get_party_balance_summary(UUID, party_type);

CREATE OR REPLACE FUNCTION get_party_balance_summary(
    p_tenant_id  UUID,
    p_party_type party_type DEFAULT NULL
)
RETURNS TABLE (
    party_id        UUID,
    party_name      TEXT,
    party_type      party_type,
    opening_balance DECIMAL(15,2),
    total_invoiced  DECIMAL(15,2),
    total_returned  DECIMAL(15,2),
    total_paid      DECIMAL(15,2),
    current_balance DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id                             AS party_id,
        p.name                           AS party_name,
        p.type                           AS party_type,
        COALESCE(p.opening_balance, 0)   AS opening_balance,
        inv.total_invoiced,
        ret.total_returned,
        pay.total_paid,
        p.balance                        AS current_balance
    FROM parties p
    -- One LATERAL per entity. Joining invoices and payments side by side and
    -- then aggregating multiplied each sum by the other side's row count.
    LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(i.total * i.exchange_rate), 0)::DECIMAL(15,2) AS total_invoiced
        FROM invoices i
        WHERE i.party_id = p.id
          AND i.tenant_id = p.tenant_id
          AND i.status = 'final'
    ) inv ON TRUE
    LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(i.total * i.exchange_rate), 0)::DECIMAL(15,2) AS total_returned
        FROM invoices i
        WHERE i.party_id = p.id
          AND i.tenant_id = p.tenant_id
          AND i.status = 'returned'
          AND i.returned_from_id IS NOT NULL
    ) ret ON TRUE
    LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pm.amount * pm.exchange_rate), 0)::DECIMAL(15,2) AS total_paid
        FROM payments pm
        WHERE pm.party_id = p.id
          AND pm.tenant_id = p.tenant_id
    ) pay ON TRUE
    WHERE p.tenant_id = p_tenant_id
      AND (p_party_type IS NULL OR p.type = p_party_type)
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PAYMENT TRIGGERS
-- =============================================================================
-- Re-emitted without the v_party_type variable that 007 selected and never
-- used. The balance moves the same way for both party types by design; the
-- dead lookup only invited someone to "fix" it into a sign flip.

CREATE OR REPLACE FUNCTION update_party_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE parties
    SET balance = balance - (NEW.amount * NEW.exchange_rate)
    WHERE id = NEW.party_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- New: closes the UPDATE gap. PaymentService.updatePayment currently whitelists
-- payment_method / reference / notes, so this is a no-op today -- but nothing in
-- the schema enforced that, and widening the whitelist would silently strand the
-- balance. Delta-based, so an unchanged amount writes nothing.

CREATE OR REPLACE FUNCTION update_party_balance_on_payment_update()
RETURNS TRIGGER AS $$
DECLARE
    v_old DECIMAL(15,2);
    v_new DECIMAL(15,2);
BEGIN
    v_old := OLD.amount * OLD.exchange_rate;
    v_new := NEW.amount * NEW.exchange_rate;

    -- A payment moved to a different party has to be reversed on the old one
    -- and applied to the new one, not netted in place.
    IF OLD.party_id IS DISTINCT FROM NEW.party_id THEN
        UPDATE parties SET balance = balance + v_old WHERE id = OLD.party_id;
        UPDATE parties SET balance = balance - v_new WHERE id = NEW.party_id;
    ELSIF v_old IS DISTINCT FROM v_new THEN
        UPDATE parties SET balance = balance - (v_new - v_old) WHERE id = NEW.party_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_party_balance_on_payment_update ON payments;
CREATE TRIGGER trigger_update_party_balance_on_payment_update
    AFTER UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_party_balance_on_payment_update();

-- =============================================================================
-- POST-MIGRATION AUDIT (run manually -- this migration changes no data)
-- =============================================================================
-- Run this BEFORE and AFTER applying the migration and diff the two result sets.
--
--   * a row only in the BEFORE set  -> pre-existing drift this fix corrects.
--     Repair it per tenant, after review:
--         SELECT recalculate_party_balance(id) FROM parties WHERE id IN (...);
--   * a row only in the AFTER set   -> the fix introduced drift. Stop and
--     investigate; do not repair.
--
-- Only parties holding a return row (status='returned' AND returned_from_id
-- IS NOT NULL) can change at all. For every other party the new function is
-- arithmetically identical to the 035 version.
--
-- SELECT p.tenant_id, p.id, p.name, p.type,
--        p.balance                                  AS stored_balance,
--        calculate_party_balance(p.id)              AS recomputed_balance,
--        p.balance - calculate_party_balance(p.id)  AS drift
-- FROM parties p
-- WHERE ABS(p.balance - calculate_party_balance(p.id)) > 0.005
-- ORDER BY 7 DESC;
