# Accounting Section — Full End-to-End Test Plan

## Context

The accounting section was rebuilt to Tally-style parity across phases P0–P9 (see `docs/tally-parity-execution.md`). All 7 migrations (021–027) are applied to the live Supabase project `wiigwaaiirwozihkzfcu`. Auto-posting is wired into sales / purchases / payments / expenses; COGS (FIFO) is optional; bill-wise allocations, party ledgers, cost centers, voucher types, audit-log triggers, operational reports (Day Book, Aging, Stock Summary), and a Settings page for defaults all exist — but **no end-to-end test pass has been done**. The hand-off doc lists a "verification path" that was never walked.

This plan walks every accounting feature through both `en` (LTR) and `ar` (RTL) locales, drives the UI with Playwright MCP, and verifies GL impact with Supabase MCP SQL queries. Decisions confirmed with the user:

- **Fix-as-you-go** — each phase fixes every blocking bug and translation gap before advancing.
- **Full bilingual coverage** — every accounting page sweeps `en` + `ar`; every hardcoded English string moves into `common.json`; RTL layout (alignment, icon mirroring, table direction) verified per page.
- **GL verification = UI + SQL** — drive the UI (e.g. finalize an invoice), then query `journal_entries` / `journal_lines` / `accounts.balance` via Supabase MCP to confirm the posting landed and balanced.

Servers run locally — web on `http://localhost:3000`, API on `http://localhost:3001/api/v1`. Test user `hossamsharif1990@gmail.com` / `Hossam1990@`. The user explicitly authorized destructive ops on this tenant's data (all data is test data).

## Outputs

1. **`docs/tally-parity-test-plan.md`** — this plan.
2. **`docs/tally-parity-test-findings.md`** — running findings log; per-phase pass / fail / fixed table.
3. **Code fixes** — every hardcoded English string moved to `common.json` with `ar` translations; every functional bug fixed.
4. **Screenshots** — saved next to the repo root using the existing `accounting-*.png` naming convention.

## Cross-cutting setup (T0)

### Dev servers
- Web: `cd apps/web; pnpm dev` (port 3000)
- API: `cd apps/api; pnpm dev` (port 3001) — needs `.env` with Supabase keys, JWT secret, CORS, Stripe placeholders.

### Login
- Path: `/{locale}/login` — selectors `#email`, `#password`, submit button.
- After login, capture the `tenant_id` from Supabase: `SELECT tenant_id FROM users WHERE email = 'hossamsharif1990@gmail.com'`. Stash it for SQL verification.

### Locale switching
- Header has `<LanguageSwitcher>` (`<select>` with `aria-label="Change language"`); options `en` / `ar`. Router rewrites URL to `/{locale}/...`.
- RTL is driven by `next-intl` + `dir="rtl"` on the html element when locale = ar.

### MCP usage conventions
- **Playwright**: `browser_navigate` → page → `browser_snapshot` (semantic tree, cheaper than screenshot) → `browser_click` / `browser_type` / `browser_fill_form` → `browser_wait_for` → `browser_take_screenshot` only at phase end.
- **Supabase**: `execute_sql` against project `wiigwaaiirwozihkzfcu`. Always include `WHERE tenant_id = '<tenant>'`. Read-only — no `apply_migration` in this pass.

### Sanity baseline (run before T1)
```sql
SELECT
  (SELECT COUNT(*) FROM accounts WHERE tenant_id = $t)                                AS account_count,
  (SELECT COUNT(*) FROM journal_entries WHERE tenant_id = $t AND is_posted)           AS posted_je_count,
  (SELECT COUNT(*) FROM bank_accounts WHERE tenant_id = $t)                           AS bank_count,
  (SELECT COUNT(*) FROM cost_centers WHERE tenant_id = $t)                            AS center_count,
  (SELECT COUNT(*) FROM accounting_default_accounts WHERE tenant_id = $t)             AS defaults_count;
```

---

## Phase T1 — Chart of Accounts

### Page
`apps/web/src/app/[locale]/(dashboard)/accounting/accounts/page.tsx`

### Scenarios (`en`, then `ar`)
1. **List + tree** — load page, snapshot. Verify hierarchical tree renders, type filter chips work, search filters work.
2. **Create leaf account** — Add → fill code/name/type/parent → save → assert appears in tree.
3. **Create group account** — same with `is_group=true` → verify in T2 it cannot be posted to.
4. **Update account** — rename → save → tree reflects new name.
5. **Delete account** — only when no children and no transactions; assert error toast when delete blocked.
6. **Type filter** — switch chips (asset/liability/equity/revenue/expense), assert tree subsets correctly.

### SQL verify
- After create: `SELECT id, code, name, type, parent_id, is_group, is_active FROM accounts WHERE tenant_id = $t ORDER BY created_at DESC LIMIT 5`.
- After update: `updated_at` changed.

### Common failure modes
- Empty/N/A children causing tree crash.
- Hardcoded English labels in column headers, dialog titles, buttons.
- RTL: tree indentation flips wrong way; chevron icon not mirrored.

### Translation sweep
- Every label/button/header → `accounting.accounts.*` in `common.json`; mirror in `ar/common.json`.

---

## Phase T2 — Journal Entries

### Pages
- `accounting/journal/page.tsx` (list)
- `accounting/journal/new/page.tsx` (form)

### Known gaps
- **Hardcoded English** in `journal/page.tsx`: page heading, description, button label, column headers, badge text (`Posted`, `Draft`), confirmation dialog text. **All to be moved into `accounting.journal.*` keys.**

### Scenarios (`en`, then `ar`)
1. **List with filters** — load, snapshot; verify voucher badges (SAL/PAY/RCT/JNL/PUR/CN/DN/COGS/REV), source links clickable for sale/purchase/payment/expense.
2. **Create manual JE** — voucher type = journal → 2+ lines (one debit, one credit, equal totals) → save Draft.
3. **Edit unposted** — open Draft → change narration/lines → save.
4. **Post entry** — Post on Draft → confirmation → status = Posted; SQL: balance update.
5. **Delete unposted** — confirm → row gone.
6. **Posted entry guard** — only "View Details" available, no Edit/Delete/Post.
7. **Unbalanced JE** — debits ≠ credits → backend rejects.
8. **Group account guard** — touch group account → backend rejects (trigger `assert_journal_line_account_is_leaf`).
9. **Source link navigation** — click Source badge → navigates to source.

### SQL verify
```sql
SELECT je.entry_number, je.voucher_type, je.is_posted,
       SUM(jl.debit) AS sum_debit, SUM(jl.credit) AS sum_credit
FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id = je.id
WHERE je.tenant_id = $t AND je.id = $jeId
GROUP BY je.id;
```

### Common failure modes
- Source-link badge href resolves wrong locale.
- Voucher badge missing for legacy entries.
- Confirmation dialog not translated.

---

## Phase T3 — Bank accounts

### Page
`accounting/banks/page.tsx`

### Scenarios (`en` + `ar`)
1. **List** — load, snapshot.
2. **Create bank** — Add → fill fields → save. Linked ledger auto-created under group "Bank Accounts".
3. **Edit bank** — rename → list reflects.
4. **Deactivate bank** — confirm → marked inactive.
5. **Statement** — open bank → date range → running balance ties to journal_lines for linked ledger.

### SQL verify
```sql
SELECT b.id, b.name, b.ledger_account_id, a.code, a.name AS ledger_name, a.balance
FROM bank_accounts b JOIN accounts a ON a.id = b.ledger_account_id
WHERE b.tenant_id = $t;
```

### Common failure modes
- Auto-ledger wrong parent.
- Currency dropdown shows raw codes only.
- RTL: currency code direction.

---

## Phase T4 — Cost Centers

### Page
`accounting/cost-centers/page.tsx`

### Scenarios (`en` + `ar`)
1. **Categories CRUD** — create / edit / deactivate.
2. **Centers CRUD** — under category, with optional parent → tree.
3. **Line allocation** — on Draft JE line, allocate across 2 centers; over-allocate → trigger rejects.
4. **Totals report** — `accounting/reports/cost-centers` → date range → sums match allocations.

### SQL verify
```sql
SELECT cc.code, cc.name, SUM(a.amount) AS allocated
FROM journal_line_cost_allocations a
  JOIN cost_centers cc ON cc.id = a.cost_center_id
WHERE a.tenant_id = $t GROUP BY cc.id;
```

---

## Phase T5 — Settings

### Page
`accounting/settings/page.tsx`

### Scenarios (`en` + `ar`)
1. **Defaults table** — all 13 roles render.
2. **Map a role** — pick account → save → reload → still set.
3. **COGS toggle** — flip on/off; capture starting state, restore at end of phase.
4. **Role labels translated** — every role name visible in Arabic when locale = ar.

### SQL verify
```sql
SELECT role, account_id FROM accounting_default_accounts WHERE tenant_id = $t ORDER BY role;
SELECT settings->'modules'->'accounting' AS acc FROM tenants WHERE id = $t;
```

---

## Phase T6 — Auto-posting (high-value verification)

### Preconditions
- T5 done (all 6 critical roles mapped: AR, AP, cash_in_hand, sales_revenue, sales_tax_payable, inventory_asset).
- ≥1 bank account exists (T3).
- A customer + supplier party exist.
- A stockable item with default purchase cost.

### T6.1 — Sales invoice (revenue path)
1. UI: `/sales/new` → customer → item → finalize.
2. UI: open invoice detail → "Journal entry JE-…" badge clickable.
3. SQL:
```sql
SELECT je.id, je.entry_number, je.voucher_type, je.is_posted,
       json_agg(json_build_object('account', a.code, 'debit', jl.debit, 'credit', jl.credit)) AS lines
FROM journal_entries je
  JOIN journal_lines jl ON jl.journal_entry_id = je.id
  JOIN accounts a ON a.id = jl.account_id
WHERE je.tenant_id = $t AND je.source_type = 'sale' AND je.source_id = $invoiceId
GROUP BY je.id;
```
Expect `voucher_type='sales'`, `is_posted=true`, debits = credits, AR = `total`, Revenue = `total - tax`, Tax Payable = `tax_amount`.

### T6.2 — Sales invoice with discount > 0
Regression check for the balancing bug fixed in P1. JE must still balance.

### T6.3 — Sales invoice with COGS on
Toggle COGS on → finalize stockable-item sale → two JEs for same `source_id` (revenue + cogs).

### T6.4 — Purchase invoice
`/purchases/new` → supplier → item → finalize → JE: Dr Inventory / Cr AP. `stock_valuation_layers` row created.

### T6.5 — Payment with bill-wise allocation
`/payments/new` → customer with outstanding invoices → bank → allocate across 2 invoices → submit:
- `payment_allocations` rows sum to payment.amount.
- JE: Dr Bank / Cr AR.
- Outstanding balances dropped.
- Over-allocate → frontend prevents OR backend trigger rejects.

### T6.6 — Expense
`/expenses/new` → fill → save → JE: Dr Expense / Cr Bank.

### T6.7 — Reversal on delete
- Delete finalized invoice → `*-reversal` JE with debits/credits swapped; account balances back to pre-finalize.

### Common failure modes
- JE created but not posted (P1 bug class).
- Balance fails: revenue computed as `subtotal` not `total - tax_amount`.
- Idempotency: finalize twice → second hits unique index, no duplicate.

---

## Phase T7 — Financial Reports (TB / P&L / BS / GL)

### Pages
- `accounting/trial-balance/page.tsx`
- `accounting/income-statement/page.tsx`
- `accounting/balance-sheet/page.tsx`
- `accounting/ledger/page.tsx`

### Known gaps
- **Hardcoded English** in `balance-sheet/page.tsx`. Audit others.

### Scenarios (`en` + `ar`)
1. **TB** — total_debits == total_credits.
2. **P&L** — revenue/expenses/net income match summed JE lines.
3. **BS** — total_assets == total_liabilities + total_equity.
4. **GL** — AR account entries reconcile to invoice/payment activity.
5. **PDF export** — download, content matches headings (incl. Arabic glyph rendering).

### SQL verify
```sql
SELECT a.type, a.code, a.name,
  SUM(jl.debit) AS dr, SUM(jl.credit) AS cr
FROM journal_lines jl
  JOIN accounts a ON a.id = jl.account_id
  JOIN journal_entries je ON je.id = jl.journal_entry_id
WHERE je.tenant_id = $t AND je.is_posted AND je.entry_date <= $asOf
GROUP BY a.id ORDER BY a.code;
```

---

## Phase T8 — Operational Reports

### Pages
- `accounting/reports/day-book/page.tsx`
- `accounting/reports/aging-receivables/page.tsx`
- `accounting/reports/aging-payables/page.tsx`
- `accounting/reports/stock-summary/page.tsx`

### Scenarios (`en` + `ar`)
1. **Day book** — every posted JE chronologically with totals; voucher_type badge renders.
2. **Aging receivables** — outstanding invoice from T6 in right bucket (0-30 since just created).
3. **Aging payables** — same for supplier.
4. **Stock summary** — item from T6.4 with qty + value.

### Common failure modes
- Aging buckets off-by-one.
- Day Book skips manual JEs (`source_type IS NULL`).
- Stock summary shows zero-qty rows.

---

## Phase T9 — Audit trail

### Component
`apps/web/src/components/audit/entity-audit-trail.tsx`

### Scenarios (`en` + `ar`)
1. **Accounts** — rename → diff shows old → new.
2. **Banks** — same pattern.
3. **Journal entries** — post then attempt-edit → audit shows create + post.
4. **Cost centers** — create + rename + deactivate.
5. **Field filtering** — `created_at`, `updated_at`, `tenant_id` hidden from diff.

### SQL verify
```sql
SELECT action, entity_type, entity_id, old_values, new_values, created_at
FROM audit_logs
WHERE tenant_id = $t AND entity_type = $type AND entity_id = $id
ORDER BY created_at DESC LIMIT 20;
```

---

## Phase T10 — Keyboard shortcuts + nav

### Scenarios (both locales)
1. F5 → `/payments/new` (made), F6 → `/payments/new` (received), F7 → `/accounting/journal/new`, F8 → `/sales/new`, F9 → `/purchases/new`, Alt+F1 → `/accounting/reports/day-book`, Shift+/ → help dialog.
2. Suppressed inside input fields.
3. Subnav active state matches route; Reports dropdown anchors correctly.
4. RTL: subnav tabs flow right-to-left.

---

## Phase T11 — i18n + RTL global sweep

1. locale = ar, walk every accounting page.
2. For each, list any English string → fix → re-walk.
3. RTL checklist per page:
   - `<html dir="rtl">` set.
   - Tables reverse, but numeric columns keep LTR.
   - Direction-implying icons mirrored.
   - Sidebar/sub-nav align right.
   - Date pickers / dropdowns open correctly.
4. `ar/common.json` mirrors every new key in `en/common.json`.

---

## Phase T12 — Regression + delivery

1. Re-run sales-with-discount + payment-bill-wise + reversal end-to-end.
2. SQL cross-check from T7 — must still balance.
3. `pnpm typecheck` + `pnpm lint` green.
4. Update `docs/tally-parity-test-findings.md` with per-phase pass/fail/fixed table.
5. Commit fixes + test docs.

---

## Verification commands quick reference

```bash
cd apps/api && pnpm dev
cd apps/web && pnpm dev
pnpm typecheck
cd apps/api && pnpm tsx src/scripts/backfill-accounting.ts --tenant <tid> --dry-run
```

```sql
-- Get tenant
SELECT id FROM tenants WHERE id IN (SELECT tenant_id FROM users WHERE email = 'hossamsharif1990@gmail.com');

-- Sanity baseline
SELECT
  (SELECT COUNT(*) FROM accounts WHERE tenant_id = $t)                                AS account_count,
  (SELECT COUNT(*) FROM journal_entries WHERE tenant_id = $t AND is_posted)           AS posted_je_count,
  (SELECT COUNT(*) FROM bank_accounts WHERE tenant_id = $t)                           AS bank_count,
  (SELECT COUNT(*) FROM cost_centers WHERE tenant_id = $t)                            AS center_count,
  (SELECT COUNT(*) FROM accounting_default_accounts WHERE tenant_id = $t)             AS defaults_count;

-- Global balance equation (after T7)
SELECT a.type, SUM(jl.debit) - SUM(jl.credit) AS net
FROM journal_lines jl
  JOIN accounts a ON a.id = jl.account_id
  JOIN journal_entries je ON je.id = jl.journal_entry_id
WHERE je.tenant_id = $t AND je.is_posted
GROUP BY a.type;
-- (assets + expenses) - (liabilities + equity + revenue) should equal 0
```
