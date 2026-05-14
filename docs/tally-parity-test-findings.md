# Accounting Section — Test Findings Log

Companion to `docs/tally-parity-test-plan.md`. Updated as each phase executes.

**Tenant under test**: `ed54a978-0a3d-4f9c-a474-3c930a95d230` (GVS) — user_id `4d8ad211-f331-470c-9bfe-d852770aa99a`
**Test user**: hossamsharif1990@gmail.com
**Started**: 2026-05-13
**Supabase project**: `wiigwaaiirwozihkzfcu`

## T0 baseline (before fixes)

- 30 accounts (11 group)
- 0 journal entries
- 0 bank accounts, 0 cost centers, 0 cost categories
- 10 default account mappings
- 7 parties, 3 invoices, 3 payments
- 0 stock valuation layers, 0 audit logs
- `tenants.settings.modules.accounting = false` (boolean) — **bug** (see Findings detail T0)

---

## Per-phase status

| Phase | Status | Pass | Fail | Fixed | Deferred |
|---|---|---|---|---|---|
| T0 — Setup | ✅ done | 5 | 1 | 1 (workaround) | 1 (root-cause for T5) |
| T1 — Chart of Accounts | ✅ done | 6 | 1 | 1 | 2 |
| T2 — Journal Entries | ✅ done | 9 | 3 | 3 | 2 |
| T3 — Banks | ✅ done | 5 | 0 | 0 | 1 |
| T4 — Cost Centers | ✅ done | 4 | 0 | 0 | 0 |
| T5 — Settings | ✅ done | 4 | 1 | 2 | 0 |
| T6 — Auto-posting | ✅ done | 3 | 1 | 0 | 3 |
| T7 — Financial Reports | ✅ done | 3 | 2 | 4 | 1 |
| T8 — Operational Reports | ✅ done | 4 | 0 | 0 | 0 |
| T9 — Audit trail | ✅ done | 1 | 0 | 0 | 0 |
| T10 — Keyboard shortcuts | ✅ done (code review) | 1 | 0 | 0 | 1 |
| T11 — i18n / RTL sweep | ✅ done (inline) | — | — | — | — |
| T12 — Regression + delivery | ✅ done | 4 | 0 | 0 | 1 |

---

## Findings detail

### T0 — Setup

**Pass:**
- Web dev server up on :3000.
- API dev server up on :3001 (health at `/health`, not `/api/v1/health` — plan reference corrected mentally).
- Login flow works with `#email` / `#password` (Playwright fills via role names).
- Locale switcher present in header (`<select aria-label="Change language">`).
- Tenant + user IDs captured, baseline counts logged.

**Bug — Accounting module flag stored as wrong type (FIX deferred to T5):**
- `tenants.settings.modules.accounting` was the literal boolean `false`, but `accounting.service.ts:165` checks `settings?.modules?.accounting?.enabled`. So `false?.enabled === undefined === false` — accounting silently disabled. This explains why the 3 existing finalized invoices and 3 payments left zero journal entries.
- **Worked around for testing**: SQL set to `{"enabled": true, "cogs_enabled": false}` so T1–T6 can proceed.
- **Root-cause to chase in T5**: find the code path (likely an "activate then deactivate" flow, or a flat `accounting_module_enabled` key handler) that writes boolean instead of object. Settings page must always write the object shape.

### T1 — Chart of Accounts

**Pass:**
- Page loads, tree renders 5 seeded root groups (Assets/Liabilities/Equity/Revenue/Expenses).
- Create leaf account works end-to-end (UI → DB verified via SQL: account 9901 T1-Test-Asset, type=asset, parent=null, is_group=false).
- Delete works (soft-delete sets `is_active=false`; row disappears from tree as expected).
- Arabic locale: every UI string — title, button labels, search/filter placeholders, expand aria-labels, dialog headings, type labels, "(مجموعة)" — renders correctly.
- RTL layout: sidebar on right, table direction reversed, subnav reversed, chevrons positioned correctly.

**Fixed:**
- `accounts/page.tsx` had hardcoded English in: toast titles (`Success`/`Error`) and bodies (`Account created/updated/deleted successfully`, `Failed to save/delete account`), `(group)` literal, empty state `No accounts found. Click "New Account"…`, dialog title `Edit Account`/`Create Account`, dialog description, all form labels (`Account Code`/`Account Name`/`Account Type`), all type options (`Asset`/`Liability`/etc.), buttons (`Cancel`/`Update`/`Create`), delete dialog (`Delete Account`, body, `Cancel`/`Delete`), aria-label `Expand/Collapse account ${code}`. All now bound to `accounting.accounts.*` keys.
- Added new keys to en + ar `common.json` under `accounting.accounts`: `groupLabel`, `emptyState`, `form.{createDescription,updateDescription,submitCreate,submitUpdate}`, `toast.{created,updated,deleted,saveError,deleteError}`.

**Deferred (not blocking, will revisit in T11):**
- Global header search placeholder `Search...` remains in English in Arabic locale. Lives in the layout's header search box, not on the accounts page itself.
- Seeded root account names (`Assets`/`Liabilities`/`Equity`/`Revenue`/`Expenses`) are stored as English text in the DB and stay English in the Arabic UI. These are tenant-editable masters, not UI strings — proper bilingual support would require either an `accounts.name_ar` column or a known-defaults translation map. Deferred as it's a schema change.

### T2 — Journal Entries

**Pass (after fixes):**
- List view renders with translated columns/badges/actions in both `en` and `ar`.
- Manual JE create via API (`POST /api/v1/journal-entries`) returns `JNL-202605-0001`, voucher_type=`journal`, is_posted=false, source_type=`manual` (auto-set by service). Idempotency index unchanged.
- Post mutation flips `is_posted=true` via UI; account balances updated correctly (Cash +100, Sales Revenue -100 — see "Bug" below re sign convention).
- Posted-entry guard works: dropdown shows only "View Details" — no Edit/Delete/Post options.
- Arabic locale: title "قيود اليومية", description, "+ قيد يومية جديد" button, all column headers, "مرحَّل"/"مسوّدة" badges, action menu, both confirmation dialogs — all rendered in Arabic with correct RTL layout.

**Fixed — Critical DB bug (blocked ALL posting):**
- `validate_journal_entry_balance()` from migration 011 was attached to a trigger on `journal_entries (BEFORE UPDATE OF is_posted)`, but the function body queried `WHERE journal_entry_id = NEW.journal_entry_id`. The `journal_entries` row has no `journal_entry_id` column (only `id`), so the trigger raised `record "new" has no field "journal_entry_id"` on every post attempt. Fixed via:
  - Live `CREATE OR REPLACE FUNCTION` against the dev DB (replaced `NEW.journal_entry_id` with `NEW.id`).
  - New migration file `packages/database/migrations/028_fix_journal_balance_trigger.sql` so the fix is included in future deploys.

**Fixed — i18n gaps in journal pages:**
- `journal/page.tsx`: hardcoded heading "Journal Entries", description, "New Journal Entry" button, all 7 column headers, "Posted"/"Draft" badges, action labels (Edit/Post Entry/Delete/View Details), Post/Delete dialog titles + descriptions + confirm buttons, empty state, source-badge aria-label, toast titles + bodies.
- `journal/new/page.tsx`: hardcoded heading, description, toast strings.
- `journal-entry-form.tsx`: Card titles (Entry Information, Journal Lines), Entry Date / Description labels + placeholders, Add Line button, 4 column headers (Account/Description/Debit/Credit), select-account placeholder, line placeholders, Totals: label, balance/unbalance/exceed messages, Save/Saving button text, validation error messages, all line aria-labels.
- All bound to new `accounting.journal.*` namespace (list / new / form sub-trees) with full Arabic translations mirrored in `ar/common.json`.

**Bug — Balance sign convention (DEFERRED for separate decision):**
- `update_account_balances_on_post()` adds `(debit − credit)` to `accounts.balance` regardless of account type. Revenue/Liability/Equity accounts (natural credit balances) end up negative, e.g. Sales Revenue shows `-100.00` after a `Cr 100` posting. The accounting-textbook convention is to either:
  - Store balances with the natural sign per type (revenue/liability/equity = credit-positive, asset/expense = debit-positive), or
  - Always store raw `debit-credit` and let reports invert based on type.
- The current code mixes the two — needs a deliberate decision before any report rewrite. Logged for T7 (TB/P&L/BS will surface whichever convention is used).

**Deferred (will revisit in T11):**
- Date column uses `date-fns format()` with no locale — Arabic shows English month names ("May 13th, 2026"). Should pass `{ locale: arSA }` when locale=ar.
- Source-badge text is raw DB enum (`manual`, `sale`, `purchase`, ...) — should map through an i18n key per type. Currently shown verbatim with `replace('-', ' ')`.
- Radix Select dropdowns (used in the JE form for account picker) render in a portal positioned outside viewport on this tall page — Playwright cannot scroll to options for clicking. UI bug if a real user encounters it on a small viewport.
- Group accounts appear in the account picker — they should be filtered out at the data-fetch level (the DB blocks posting via `assert_journal_line_account_is_leaf`, but UI shouldn't even offer them).

### T3 — Banks

**Pass:**
- Page renders with full i18n bindings already in place — no code changes needed.
- Create flow works: POST `/banks` with name=Main Checking, bank=Chase, account=****9911, opening_balance=1000, currency=USD → SQL confirms bank row + auto-created ledger `1131 Main Checking` (asset) under parent `Current Assets` (1100).
- Arabic locale: "الحسابات البنكية", "إضافة حساب بنكي", dialog labels all render correctly with RTL.

**Deferred:**
- `opening_balance` is stored on the bank row but no opening JE is posted, so `accounts.balance` for the linked ledger stays 0 until real activity arrives. The Bank Statement view will need to add `opening_balance + sum(journal_lines)` to compute the running balance. Not a regression — design choice — but should be documented.

### T12 — Regression + delivery

**Pass:**
- Final Trial Balance SQL cross-check: `total_debits = total_credits = 600` (assets +600, liab -300, revenue -300 → net 0) ✓
- `tenants.settings.modules.accounting` retains `{enabled:true, cogs_enabled:false}` round-trip after all phases.
- Test plan and findings docs are present in `docs/` for future runs (`tally-parity-test-plan.md`, `tally-parity-test-findings.md`).
- `pnpm type-check` for files I edited (`journal-entry.repository.ts`, `accounting.service.ts:isEnabled/setCogsEnabled`, all locales, all frontend pages I rewrote): **clean**.

**Deferred (pre-existing, NOT introduced by this work):**
- `pnpm type-check` overall is still red because of long-standing type errors in: `audit.service.ts`, `currency.service.ts`, `party.service.ts:recalculate_party_balance/get_party_balance_summary` RPC names, `payroll.service.ts:total_amount` column rename, `user.service.ts` unused var. These predate this test pass; they were flagged in earlier sessions and tracked separately. Out of scope for the accounting test pass.

### T10 — Keyboard shortcuts

**Pass (code review):**
- `global-shortcuts.tsx` mounts at the dashboard layout, intercepts keys via `useEffect` + `keydown` listener.
- F5 → /payments/new, F6 → /payments/new (receipt), F7 → /accounting/journal/new, F8 → /sales/new, F9 → /purchases/new, Alt+F1 → /accounting/reports/day-book, Shift+/ → opens help dialog.
- `isTypingTarget()` correctly suppresses inside INPUT/TEXTAREA/SELECT/contenteditable and Radix combobox targets.
- All `labelKey` references resolve under `accounting.shortcuts.*` (already populated for en+ar).

**Deferred:**
- Browser-level interception of F5 is unreliable (some browsers handle it before the page) — confirmed as a Tally-style ergonomic, not enforced. Real-user testing recommended on Chrome/Edge/Firefox where browsers may consume the key first.

### T11 — i18n + RTL global sweep

This phase was executed inline as part of T1–T8 rather than as a separate pass: every accounting page was loaded in both `en` and `ar`, every hardcoded English string was moved into `accounting.*` keys in `common.json`, every translation was mirrored into `ar/common.json`. RTL layout was verified visually via screenshots saved to repo root (`accounting-t1-accounts-ar.png`, `accounting-t2-journal-ar.png`, `accounting-t3-banks-ar.png`, `accounting-t4-costcenters-ar.png`, `accounting-t5-settings-ar.png`, `accounting-t7-trial-balance-en-loaded.png`, `accounting-t8-daybook-ar.png`).

**Stragglers (logged for follow-up):**
- Global header `Search...` placeholder lives in dashboard layout (not accounting-namespaced) — unchanged in Arabic.
- Seeded chart-of-accounts root names (`Assets`/`Liabilities`/...) are DB data; need bilingual storage to render in Arabic.
- Date column in journal list uses `date-fns format()` without `arSA` locale, so month names stay English.
- Source-type badge in journal list shows raw enum value (`manual`/`sale`/...). Day Book has its own translation map; journal list does not.

### T9 — Audit trail

**Pass:**
- `audit_logs` table populated by the migration 026 generic trigger across all 7 accounting tables. Counts confirmed via SQL:
  - 2 account creates + 11 updates (balance changes on post)
  - 1 bank_account create
  - 1 cost_category create
  - 5 journal_entry creates + 6 updates
- All write through the `auto_audit_changes()` SECURITY DEFINER function — captures `tenant_id`, `user_id`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`. Front-end `entity-audit-trail.tsx` reads from this same table via `useEntityAuditLogs` hook (pre-existing wiring).

### T8 — Operational Reports

**Pass:**
- **Day Book** (`reports/day-book`): all 5 posted vouchers from T6 listed chronologically (JNL-0001, PUR-0001, RCT-0001, SAL-0001, SAL-0002). Totals 750=750 ✓. Source-type badges (Manual, Purchase, Payment, Sale) localized via existing i18n. Arabic locale "دفتر اليومية" with full RTL works.
- **Aging Receivables** (`reports/aging-receivables`): exactly matches T6 outcome — Beta Trading Co $50.00 in 0-30 bucket. Reconciles with `payment_allocations` SQL: `200 (2 invoices) - 150 (allocated) = 50` outstanding.
- Already-localized pages — no code changes needed for T8.

### T7 — Financial Reports

**Pass — Trial Balance API:**
- Returns balanced totals `{ total_debits: 600, total_credits: 600 }` matching the SQL cross-check `(assets 600) - (liabilities 300 + revenue 300) = 0`.
- 6 rows: Cash 100 Dr, Inventory 300 Dr, Main Checking 150 Dr, Beta Trading Co 50 Dr (200 sales - 150 alloc), Sales Revenue 300 Cr, Acme Wholesale 300 Cr.

**Fixed — Critical DB query bug (blocked TB / IS / BS / GL):**
- `journal-entry.repository.ts:getAccountLines()` used PostgREST embedded-resource syntax that failed two ways:
  - `.order('journal_entries.entry_date', ...)` → `"failed to parse order"`.
  - After first fix, `'journal_lines' is not an embedded resource in this request`.
- **Fix**: rewrote as a two-step query — first fetch entry IDs matching the date filter, then fetch lines `IN` those IDs and sort in JS. Avoids the PostgREST quirks entirely. All four financial reports now work.

**Fixed — i18n gaps across 4 report pages:**
- `trial-balance/page.tsx` — title, description, columns (Account Code/Name/Type/Debit/Credit), "As Of Date", "Generate Report", "Export PDF", "Totals:", `account_type` cell now uses `accounting.accounts.type.{asset|liability|...}` keys.
- `income-statement/page.tsx` — Revenue/Expenses/Total Revenue/Total Expenses/Net Income headers, Start/End Date labels.
- `balance-sheet/page.tsx` — Assets/Liabilities/Equity sections, Total* labels, "Total Liabilities & Equity".
- `ledger/page.tsx` — title, description, Account label, Beginning/Ending Balance, Select-account placeholder, 6 column headers.
- All bound to `accounting.financialReports.{trialBalance,incomeStatement,balanceSheet,generalLedger,common}` keys; full Arabic mirroring in `ar/common.json`.

**Deferred:**
- React Query may cache the earlier 500-response errors before the repository fix, so the TB UI shows a persistent spinner on first load even after the fix landed. A hard reload clears it. Not a code defect — a dev-session artifact.

### T6 — Auto-posting verification

**Pass — Purchase (T6.4):**
- POST `/invoices` (type=purchase, party=Acme Wholesale, item×10@$30) + finalize → JE `PUR-202605-0001`, voucher_type=`purchase`, posted.
- Lines: Dr `1130 Inventory` 300 / Cr party-ledger `PTY-8a7a0cff Acme Wholesale` 300 — balanced and uses party ledger (P4 working).
- `inventory.quantity` updated to 10 units in Main Warehouse.

**Pass — Sales basic (T6.1):**
- Sale to Beta Trading Co (2 units @ $50) → JE `SAL-202605-0001`, voucher_type=`sales`, posted.
- Lines: Dr party-ledger `PTY-4ce74529 Beta Trading Co` 100 / Cr `4100 Sales Revenue` 100 — balanced, uses party ledger.

**Pass — Payment with bill-wise allocation (T6.5):**
- POST `/payments` (received, $150, allocations: 100 to SAL-0002 + 50 to SAL-0003, bankAccountId=Main Checking).
- `payment_allocations` rows: 2 entries totaling $150 ✓.
- JE `RCT-202605-0001`, voucher_type=`receipt`, posted. Lines: Dr `1131 Main Checking` (the bank's auto-ledger) 150 / Cr party-ledger 150.
- Bank routing + party-ledger routing both working as designed.

**Bug found and noted (DEFERRED — not blocking core posting):**
- **Line-level discount on sales doesn't apply**: created a sale with `items[0].discount = 10` but the invoice still totaled $100 (subtotal=$100, discount_amount=$0). The discount field is invoice-level (top-level `discount`), not line-level. Schema accepts the field but silently ignores it. Either remove from item schema or wire it into the line subtotal. As a result, the original "balancing bug regression check" (T6.2) couldn't be exercised directly. The orphan-template fix (revenue = `total - tax_amount`) is logically sound — verified by code reading, not by test.

**Deferred — not exercised in this pass:**
- **T6.3 COGS-on**: COGS toggle is off on the dev tenant. Enabling it then running a sale would also write a `stock_valuation_layer` (the purchase didn't record one because COGS was off when it ran). Combined behaviour is verified by code but not driven end-to-end here.
- **T6.6 Expense auto-posting**: same wiring pattern as payment; left for full bilingual sweep at T11.
- **T6.7 Reversal on delete**: Invoice SAL-0002 now has a payment allocation, so deleting would test reversal across two tables. Deferred — needs an unallocated finalized invoice to test cleanly.

### T5 — Settings (defaults + COGS toggle)

**Pass:**
- Page renders all 13 default-role rows: cash_in_hand, accounts_receivable, accounts_payable, sales_revenue, sales_tax_payable, inventory_asset, cogs, discount_allowed, discount_received, salary_expense, salary_payable, general_expense, service_purchase_expense.
- 10 roles already mapped (from default chart seed); 3 unset (discount_allowed, discount_received, salary_payable).
- COGS toggle: clicking writes `{"enabled":true,"cogs_enabled":true}` to `tenants.settings.modules.accounting`. Toggle off writes `{"enabled":true,"cogs_enabled":false}`. Both round-trip correctly.

**Fixed — Root cause of T0 bug (dual-shape settings):**
- `apps/api/src/services/settings.service.ts:110` initializes new tenants with `modules: { stock: true, accounting: false, hr: false }` (boolean shape), AND there's a flat `accounting_module_enabled: false` flag at the same level.
- The newer accounting code (`accounting.service.ts:165`) reads `settings?.modules?.accounting?.enabled` — so the boolean `false` had no `.enabled` → undefined → accounting silently off.
- The activation wizard wrote into the flat `accounting_module_enabled` flag (legacy path) but never touched `modules.accounting`, leaving the new code's view unchanged.
- **Fix applied** in `apps/api/src/services/accounting.service.ts`:
  - `isEnabled()` now tolerates all three shapes: `modules.accounting === true`, `modules.accounting.enabled === true`, and the legacy flat `accounting_module_enabled === true`. Any one of those flips it on.
  - `setCogsEnabled()` now coerces the legacy boolean shape to an object before writing `cogs_enabled`, preserving the previous enabled flag.
- T6 will retest the auto-posting paths to confirm `isEnabled()` now sees the dev tenant as enabled without the T0 manual SQL workaround.

**Pass — Arabic locale:**
- Subnav and page chrome render in Arabic with RTL layout.

### T4 — Cost Centers

**Pass:**
- Page renders with full i18n bindings, both `en` and `ar`.
- Create category flow: dialog opens, accepts "Department" → SQL confirms `cost_categories` row inserted.
- Empty-state messaging in both locales ("No categories yet." / "0 مركز").
- Subnav highlights cost-centers tab correctly in RTL.
- Category list shows under "الفئات" with "+ إضافة مركز" CTA disabled until category selected.





