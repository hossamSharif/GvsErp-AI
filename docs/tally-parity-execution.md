# Tally-Parity Execution Log

**Status:** complete (P0–P9 shipped; P2 originally deferred then shipped at the end)
**Live DB:** Supabase project `wiigwaaiirwozihkzfcu`
**Migrations applied:** 021 → 027 (in order)
**Code branch:** `001-modular-erp-saas`

This document records what was actually shipped, in execution order, with the deltas from the original plan. The original design plan lives at `C:\Users\skd\.claude\plans\disscussion-accounting-section-enhance-pure-seahorse.md` — use this file as the as-built reference; consult the original when you need the rationale behind a design choice.

---

## Context

Before this work the ERP had a working double-entry accounting core (chart of accounts, balanced journal entries, trial balance / P&L / balance sheet) but **only payroll auto-posted to it**. Sales, POS, purchases, customer/supplier payments, and expenses left no GL footprint. Four "auto-posting" templates existed in `apps/api/src/services/accounting.service.ts` (lines 701–956 at start of work) but were orphaned — never called, never posted, and contained a balancing bug.

Goal: bring the accounting UX and behavior in line with **Tally Prime**, propagating changes consistently across sales, POS, purchases, payments, expenses, inventory, and HR.

User-set constraints at planning time:
- **Scope**: "Everything including polish" → all nine phases
- **Tax**: out of scope (no GST/VAT split — tax stays bundled)
- **Backfill**: full historical backfill via dedicated script

---

## Phase execution order (as shipped)

| Phase | Title | Migration | Status |
|---|---|---|---|
| P0 | Foundation (defaults table, idempotency index, repo bug fix) | 021 | ✅ |
| P1 | Wire orphan auto-posting + balance fix | (021 reused) | ✅ |
| P3 | Bank accounts + bill-wise allocations | 022 | ✅ |
| P4 | Party-as-ledger | 023 | ✅ |
| P5 | COGS + FIFO inventory valuation (feature-flagged) | 024 | ✅ |
| P6 | Operational reports (Day Book, Aging, Stock Summary) | (no DDL) | ✅ |
| P7 | Cost centers / categories | 025 | ✅ |
| P8 | Edit log / audit trail | 026 | ✅ |
| P9 | UX polish (sub-nav, F-keys) | (no DDL) | ✅ |
| **P2** | **Voucher types** (originally deferred to keep P3+ moving) | **027** | **✅ shipped last** |

The plan said P2 + P3 were "independent — can be parallel work streams." P2 was held back so P3 (the more functional change) could ship first; circled back at the end once everything else was stable.

---

## Cross-cutting design choices

### Idempotency
A partial unique index on `journal_entries (tenant_id, source_type, source_id) WHERE is_posted = true AND source_type IS NOT NULL` (migration 021) ensures the same source row never produces two posted entries even on retry. Service code catches the 23505 unique-violation and returns the existing entry. See `AccountingService.createAndPost()`.

### Reversal (never UPDATE a posted entry)
`AccountingService.reverseEntry(tenantId, userId, sourceType, sourceId, reason)` posts a mirror entry with debits/credits swapped and `source_type = '<original>-reversal'`. Called from invoice / payment / expense delete paths. Also handles COGS reversal on sale delete and FIFO-layer zeroing on purchase delete.

### Feature flag
`tenants.settings.modules.accounting.enabled` (existing) gates all auto-posting. P5 adds a second flag `tenants.settings.modules.accounting.cogs_enabled` gating COGS specifically.

### Default-account mapping
`accounting_default_accounts (tenant_id, role, account_id)` table (P0). 13 roles defined in `AccountingDefaultRole` union. Mapping is auto-seeded on `importDefaultChartOfAccounts()` and also via migration 021's one-shot seed for tenants who already activated accounting.

### Historical backfill
`apps/api/src/scripts/backfill-accounting.ts` — idempotent via the unique index. Flags: `--tenant <uuid>` / `--all` / `--dry-run`.

---

## Migrations (applied in order)

### 021 — accounting_defaults_and_idempotency
**File:** `packages/database/migrations/021_accounting_defaults_and_idempotency.sql`
- `CREATE TABLE accounting_default_accounts` with 13-role CHECK + RLS + `service_role` bypass + `updated_at` trigger.
- Partial unique index `uq_journal_entries_source_posted` for idempotency.
- One-shot seed mapping `(1110→cash_in_hand, 1120→accounts_receivable, …, 5210→salary_expense)` for tenants with existing chart of accounts.

### 022 — bank_accounts_and_allocations
**File:** `packages/database/migrations/022_bank_accounts_and_allocations.sql`
- `bank_accounts` (1:1 to a ledger via `ledger_account_id`, unique on `(tenant_id, ledger_account_id)`).
- `ALTER payments ADD COLUMN bank_account_id`.
- `payment_allocations` with `AFTER INSERT/UPDATE/DELETE` sum-check trigger (Σ amounts ≤ `payments.amount`).
- Idempotent backfill: copies every existing `payments.invoice_id` into `payment_allocations`.

### 023 — party_ledgers_and_groups
**File:** `packages/database/migrations/023_party_ledgers_and_groups.sql`
- `ALTER accounts ADD COLUMN is_group BOOLEAN`, `nature TEXT`.
- Auto-flag existing parent accounts as `is_group = true`.
- `ALTER parties ADD COLUMN ledger_account_id`.
- `BEFORE INSERT/UPDATE` trigger on `journal_lines.account_id` that **rejects postings to group accounts** (Tally semantics).
- One-shot backfill: every existing party gets a `PTY-<first8 of uuid>`-coded ledger under accounts_receivable / accounts_payable; those parents get promoted to `is_group = true`.

### 024 — inventory_valuation
**File:** `packages/database/migrations/024_inventory_valuation.sql`
- `ALTER items ADD COLUMN valuation_method TEXT DEFAULT 'fifo'`, `avg_cost DECIMAL(15,4)` (with CHECK for `fifo | weighted_average`).
- `stock_valuation_layers` append-only table.
- `ALTER invoice_items ADD COLUMN cogs_amount DECIMAL(15,2)`.

### 025 — cost_centers
**File:** `packages/database/migrations/025_cost_centers.sql`
- `cost_categories` (top-level dimension: Department / Project / Branch).
- `cost_centers` (optionally nested via `parent_id`; unique `(tenant_id, code)`).
- `journal_line_cost_allocations` with sum-check trigger (Σ ≤ `journal_lines.debit + credit`).

### 026 — accounting_audit_triggers
**File:** `packages/database/migrations/026_accounting_audit_triggers.sql`
- Reuses the existing `audit_logs` table from migration 010 — no new audit infrastructure.
- `auto_audit_changes()` PL/pgSQL function (SECURITY DEFINER, captures `auth.uid()` when available).
- AFTER INSERT/UPDATE/DELETE triggers on **seven** accounting-critical tables: `accounts`, `journal_entries`, `bank_accounts`, `cost_categories`, `cost_centers`, `journal_line_cost_allocations`, `accounting_default_accounts`.
- Intentionally **skipped**: `journal_lines` (volume noise), `parties` (cross-module), `stock_valuation_layers` (already traceable via `source_invoice_id`).

### 027 — voucher_types (Phase 2, shipped last)
**File:** `packages/database/migrations/027_voucher_types.sql`
- `voucher_type` ENUM: `contra | payment | receipt | journal | sales | purchase | credit_note | debit_note | cogs | reversal`.
- `ALTER journal_entries ADD COLUMN voucher_type`, `narration`.
- Backfill: derives `voucher_type` from `source_type` for every existing JE; refines `payment` → `receipt` when the source payment is of type `received`.
- `voucher_sequences` table for atomic per-type monthly counters.
- Replaces `generate_journal_entry_number()` with a version that uses voucher-typed prefixes (`SAL-` / `PUR-` / `RCT-` / `PAY-` / `JNL-` / `CON-` / `CN-` / `DN-` / `COGS-` / `REV-`).

---

## Code changes (high level)

### Backend (`apps/api/`)
- `src/services/accounting.service.ts` — rewritten extensively. Added `isEnabled`, `getDefaultAccountIds`, `setDefaultAccount`, `reverseEntry`, `seedDefaultAccountMappings`, `ensurePartyLedger`, `syncPartyLedgerName`, `getPartyLedgerOrDefault`, `generateJournalEntryFromCogs`, `isCogsEnabled`, `setCogsEnabled`, `generateStockSummary`, `generateDayBook`, `generateAgingReport`, `sourceTypeToVoucherType`. Rewrote all four orphan templates (`generateJournalEntryFromSale/Purchase/Payment/Expense`) — fixed the balance bug (revenue = `total - tax_amount`, not `subtotal`), auto-`.post()`, fetched defaults internally, idempotency-aware, party-ledger-aware, bank-ledger-aware, voucher-type-stamping.
- `src/repositories/journal-entry.repository.ts` — **bug fix**: was writing `date`/`reference`/`is_auto` (columns that don't exist); now writes `entry_date`/`source_type`/`source_id`/`is_posted`. Added `findBySource`. P2 added `voucher_type`/`narration` write+map.
- `src/services/invoice.service.ts` — `finalizeInvoice` auto-posts revenue JE + COGS JE; `deleteInvoice` reverses both + zeroes layers. Threads party_id and bank_account_id.
- `src/services/payment.service.ts` — accepts `bankAccountId` + `allocations[]`, threads party_id to JE generator. Added `validateAllocations`, `getOutstandingInvoices`. Removed dead `validateInvoice`.
- `src/services/expense.service.ts` — auto-posts JE + reverse on delete.
- `src/services/party.service.ts` — auto-creates party ledger on create; syncs name on rename.
- `src/services/bank.service.ts` (new) — CRUD with ledger auto-creation under Current Assets (next free `11xx` code).
- `src/services/inventory-valuation.service.ts` (new) — `recordLayersForPurchase`, `consumeLayersForSale`, `reverseLayersForPurchase`. Short-stock fallback at zero cost.
- `src/services/cost-center.service.ts` (new) — CRUD + `setLineAllocations` + `getCostCenterTotals`.
- `src/routes/`: new `banks.routes.ts`, `cost-centers.routes.ts`. Extended `accounting.routes.ts` with `/defaults`, `/cogs`, `/reports/{day-book, aging-receivables, aging-payables, stock-summary}`. Extended `payments.routes.ts` with `/outstanding-invoices`.
- `src/scripts/backfill-accounting.ts` (new) — historical catch-up.

### Web (`apps/web/`)
- **New pages** under `src/app/[locale]/(dashboard)/accounting/`:
  - `settings/page.tsx` — COGS toggle + role → ledger mapping
  - `banks/page.tsx` — bank account CRUD
  - `cost-centers/page.tsx` — categories + centers
  - `reports/day-book/page.tsx`
  - `reports/aging-receivables/page.tsx`
  - `reports/aging-payables/page.tsx`
  - `reports/stock-summary/page.tsx`
  - `reports/cost-centers/page.tsx`
- **Layouts**: new `accounting/layout.tsx` mounts the sub-nav. Dashboard layout mounts `<GlobalShortcuts />`.
- **Components**:
  - `components/accounting/accounting-subnav.tsx` — horizontal tabs + Reports dropdown
  - `components/accounting/global-shortcuts.tsx` — F-key router
  - `components/accounting/shortcuts-help-dialog.tsx` — cheatsheet
  - `components/audit/entity-audit-trail.tsx` — reusable Edit Log panel
  - `components/reports/aging-report.tsx` — shared for receivables + payables
- **Modified**: `components/forms/payment-form.tsx` (bank dropdown + bill-wise picker), `accounting/journal/page.tsx` (voucher_type badge), `accounting/accounts/page.tsx` (group rows distinct), `customers/[id]/page.tsx` and `suppliers/[id]/page.tsx` ("View Ledger" + audit trail), `sales/[id]/page.tsx` and `purchases/[id]/page.tsx` (audit trail).
- **Hooks**: new `use-banks.ts`, `use-cost-centers.ts`. Extended `use-accounting.ts` (defaults, COGS flag, reports), `use-payments.ts` (outstanding invoices).
- **i18n**: full en + ar coverage for every new surface.

### Shared types (`packages/shared/src/types/`)
- New: `banks.ts`, `cost-centers.ts`.
- Extended `accounting.ts` (`VoucherType`, `DayBookReport`, `AgingReport`, `Account.is_group`), `audit.ts` (5 new entity types), `parties.ts` (`Party.ledgerAccountId`; `CreatePaymentInput.bankAccountId` + `allocations`).

---

## Verification path (end-to-end)

1. **Restart the API** (`pnpm dev` in `apps/api`) — new wiring only activates after restart.
2. `/accounting/settings` → confirm 13 role rows render; defaults pre-populated for tenants that activated accounting before the migrations.
3. Create a customer with a name → confirm a `PTY-…` ledger appears under Accounts Receivable in `/accounting/accounts`. Rename the customer → ledger renames too.
4. Create a sales invoice with discount AND tax → finalize → `/accounting/journal` shows it with a green **SAL** badge, entry number like `SAL-202605-0001`. Trial balance shows revenue + the party's own ledger (under Sundry Debtors).
5. Record a customer payment → confirm it shows as **RCT**. Allocate across two invoices in the bill-wise picker.
6. Delete the sale → a **REV** entry appears in the journal.
7. `/accounting/banks` → "Add Bank Account" with just a name → ledger auto-appears under Current Assets.
8. Record a payment routed through the bank → JE posts to the bank's ledger, not generic cash.
9. `/accounting/settings` → toggle COGS on. Record a purchase 10@$5 then sell 6 → `invoice_items.cogs_amount = 30`; a second JE with `Dr COGS / Cr Inventory $30` appears; `/accounting/reports/stock-summary` shows 4 units @ $5.
10. `/accounting/reports/day-book` for the period → every voucher appears chronologically with debit/credit totals.
11. `/accounting/reports/aging-receivables` → buckets populate based on payment_allocations.
12. `/accounting/cost-centers` → create a category, create centers, tag a journal line via `PUT /cost-centers/journal-lines/:id/allocations`. `/accounting/reports/cost-centers` shows the totals.
13. Press **F8** anywhere in the dashboard → routes to `/sales/new`. Press **?** → cheatsheet opens.
14. Customer detail page → "Edit Log" panel shows recent changes with field-level diff.
15. Run the backfill if you have historical finalized invoices without JEs: `pnpm tsx apps/api/src/scripts/backfill-accounting.ts --all --dry-run` then without `--dry-run`.

---

## Known issues / deferred work

### ⚠️ Pre-existing RLS finding (NOT introduced by this work)
Supabase security advisor flagged every `tenant_isolation_*` policy that reads `tenant_id` from `(auth.jwt() -> 'user_metadata') ->> 'tenant_id'`. `user_metadata` is end-user-editable in Supabase by default, so a malicious user could potentially override their tenant_id and reach another tenant's data.

This pattern was established by migrations 013 / 015 / 017 / 020 across 12+ tables (items, invoices, parties, payments, accounts, journal_entries, payment_sequences, etc.) before this work. The new accounting migrations (021–027) follow the same established pattern for consistency.

**Fix** (out of scope here — cross-cutting auth change):
1. Move `tenant_id` from `user_metadata` to `app_metadata` (admin-only-writable) in `apps/api/src/middleware/auth.ts` and the user-creation flow.
2. Rewrite every `tenant_isolation_*` policy to read from `app_metadata`.
3. Adjust `apps/api/src/middleware/tenant.ts` to read from the new claim path.

Reference: <https://supabase.com/docs/guides/database/database-linter?lint=0015_rls_references_user_metadata>

### Scope-deferred features
- **Tax-split** (Output Tax Payable / Input Tax Recoverable for purchase, statutory reports for GST/VAT). Deferred at planning time; re-open when a jurisdiction is chosen.
- **Weighted-average valuation** — the `valuation_method` column accepts it, but `InventoryValuationService` only implements FIFO. Adding weighted-average is mechanical (no new schema).
- **Voucher-typed entry forms** under `/accounting/voucher/[type]/new`. P2 shipped the data model and stamping but not dedicated entry screens for Contra (F4), Credit Note, Debit Note. The existing manual-journal form covers `journal`; the others currently flow through sale-return / purchase-return / payment.
- **Sale-return / purchase-return → Credit/Debit Note auto-post** — the return path skips auto-posting today. Wire it on the return code path in `invoice.service.ts createReturn` to emit `voucher_type: 'credit_note' | 'debit_note'` with the right line direction.
- **Voucher-specific shortcuts** — F4 Contra, Ctrl+F8 Credit Note, Ctrl+F9 Debit Note. Currently routed to generic forms; need dedicated entry screens first.
- **Ctrl+K command palette** across ledgers / parties / vouchers. Needs a multi-source search endpoint.
- **<VoucherEntry>** unified single-screen voucher component. P9 left this as a follow-up because without the voucher-typed entry routes above it wouldn't change UX meaningfully.
- **JE badge on detail pages** — sales/purchase/payment/expense detail pages could surface the linked JE inline (mini-component using `GET /journal-entries?source_type=X&source_id=Y&limit=1`). Backend ready; frontend touchup small.
- **Audit trail rollout** — `<EntityAuditTrail>` is mounted on customer / supplier / sale / purchase detail. Adding it to payment, expense, bank, cost-center detail is one-line copy-paste each.

### Schema-level notes for future maintenance
- `journal_lines` has no audit trigger (intentional — too noisy). If line-level history becomes needed, add a trigger but consider sampling or compaction.
- `stock_valuation_layers` is append-only. Never `DELETE` from this table — zero out `qty_remaining` instead (preserves FIFO audit trail).
- After P4's backfill, historical `journal_lines` may still reference the OLD generic AR / AP accounts (now `is_group = true`). The `assert_journal_line_account_is_leaf` trigger only fires on INSERT/UPDATE of `account_id`, so historical rows are untouched. New posts must go to party-specific ledgers; the service code handles this.

---

## File index — full list of files created or modified

### Migrations (new, in `packages/database/migrations/`)
```
021_accounting_defaults_and_idempotency.sql
022_bank_accounts_and_allocations.sql
023_party_ledgers_and_groups.sql
024_inventory_valuation.sql
025_cost_centers.sql
026_accounting_audit_triggers.sql
027_voucher_types.sql
```

### API (`apps/api/src/`)
```
services/accounting.service.ts          (heavily extended)
services/invoice.service.ts             (auto-post + reversal + COGS wiring)
services/payment.service.ts             (allocations + bank routing)
services/expense.service.ts             (auto-post + reversal)
services/party.service.ts               (party-ledger sync)
services/bank.service.ts                (NEW)
services/inventory-valuation.service.ts (NEW)
services/cost-center.service.ts         (NEW)
repositories/journal-entry.repository.ts (bug fix + extended)
repositories/party.repository.ts        (ledgerAccountId mapping)
routes/accounting.routes.ts             (defaults, cogs, reports)
routes/payments.routes.ts               (outstanding-invoices)
routes/banks.routes.ts                  (NEW)
routes/cost-centers.routes.ts           (NEW)
routes/index.ts                         (mount banks, cost-centers)
scripts/backfill-accounting.ts          (NEW)
```

### Web (`apps/web/src/`)
```
app/[locale]/(dashboard)/layout.tsx                                  (mount GlobalShortcuts)
app/[locale]/(dashboard)/accounting/layout.tsx                       (NEW — sub-nav)
app/[locale]/(dashboard)/accounting/settings/page.tsx                (NEW)
app/[locale]/(dashboard)/accounting/banks/page.tsx                   (NEW)
app/[locale]/(dashboard)/accounting/cost-centers/page.tsx            (NEW)
app/[locale]/(dashboard)/accounting/reports/day-book/page.tsx        (NEW)
app/[locale]/(dashboard)/accounting/reports/aging-receivables/page.tsx (NEW)
app/[locale]/(dashboard)/accounting/reports/aging-payables/page.tsx  (NEW)
app/[locale]/(dashboard)/accounting/reports/stock-summary/page.tsx   (NEW)
app/[locale]/(dashboard)/accounting/reports/cost-centers/page.tsx    (NEW)
app/[locale]/(dashboard)/accounting/journal/page.tsx                 (voucher_type badge)
app/[locale]/(dashboard)/accounting/accounts/page.tsx                (group rows distinct)
app/[locale]/(dashboard)/customers/[id]/page.tsx                     (View Ledger + audit)
app/[locale]/(dashboard)/suppliers/[id]/page.tsx                     (View Ledger + audit)
app/[locale]/(dashboard)/sales/[id]/page.tsx                         (audit trail)
app/[locale]/(dashboard)/purchases/[id]/page.tsx                     (audit trail)
components/accounting/accounting-subnav.tsx        (NEW)
components/accounting/global-shortcuts.tsx         (NEW)
components/accounting/shortcuts-help-dialog.tsx    (NEW)
components/audit/entity-audit-trail.tsx            (NEW)
components/reports/aging-report.tsx                (NEW)
components/forms/payment-form.tsx                  (bank + bill-wise)
hooks/use-accounting.ts                            (defaults, cogs, reports)
hooks/use-banks.ts                                 (NEW)
hooks/use-cost-centers.ts                          (NEW)
hooks/use-payments.ts                              (outstanding invoices)
locales/en/common.json                             (all new keys)
locales/ar/common.json                             (all new keys)
```

### Shared (`packages/shared/src/`)
```
types/accounting.ts        (VoucherType, DayBook, Aging, is_group, narration)
types/banks.ts             (NEW)
types/cost-centers.ts      (NEW)
types/parties.ts           (ledgerAccountId, CreatePaymentInput extensions)
types/audit.ts             (5 new entity types)
types/index.ts             (re-exports)
validation/parties.ts      (createPaymentSchema with allocations + bankAccountId)
```

---

## Quick command reference

```bash
# Apply a new migration locally (or use Supabase MCP / dashboard)
supabase db push

# Run the historical backfill (idempotent — safe to re-run)
cd apps/api
pnpm tsx src/scripts/backfill-accounting.ts --all --dry-run   # preview
pnpm tsx src/scripts/backfill-accounting.ts --all              # apply
pnpm tsx src/scripts/backfill-accounting.ts --tenant <uuid>    # one tenant

# Sanity check after restart
curl /api/v1/accounting/defaults                # returns 13 role mappings
curl /api/v1/accounting/cogs                    # returns {enabled: false}
curl /api/v1/banks                              # list bank accounts
```
