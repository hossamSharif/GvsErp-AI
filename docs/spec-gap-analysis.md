# Spec Gap Analysis — 001-modular-erp-saas

Reviewed against: `specs/001-modular-erp-saas/spec.md`
Date: 2026-03-08 | Reviewer: Project Manager (Loop 5 iter 10; 514 tests across 26 suites)

## Coverage Summary

| Module | FRs | Implemented | Partial | Missing |
|--------|-----|-------------|---------|---------|
| Items Management | FR-001–004 | 4 | 0 | 0 |
| Warehouse Management | FR-005–009 | 5 | 0 | 0 |
| POS Management | FR-010–012 | 2 | 1 | 0 |
| Sales Management | FR-013–019 | 5 | 2 | 0 |
| Purchase Management | FR-020–025 | 4 | 2 | 0 |
| Customers & Suppliers | FR-026–031 | 6 | 0 | 0 |
| **Expenses** | **FR-032–034** | **0** | **0** | **3** |
| Subscription & Tenancy | FR-035–036 | 2 | 0 | 0 |
| Localization | FR-037–038 | 2 | 0 | 0 |
| Themes | FR-039–040 | 2 | 0 | 0 |
| Logging | FR-041–042 | 2 | 0 | 0 |
| Authorization | FR-043–044 | 2 | 0 | 0 |
| Currency | FR-045–046 | 2 | 0 | 0 |
| UX Requirements | FR-047–049 | 2 | 1 | 0 |
| Accounting Module | FR-050–061 | 8 | 1 | 3 |
| HR Module | FR-062–073 | 8 | 2 | 2 |

## Critical Gaps (Missing Entirely)

### 1. Expenses Module (FR-032, FR-033, FR-034)
- No expenses page exists (`apps/web/src/app/[locale]/(dashboard)/expenses/`)
- No expenses API routes (`apps/api/src/routes/expenses.routes.ts`)
- No expenses service, repository, or types
- **Impact**: User Story 7 completely unimplemented

### 2. Cash Flow Statement (FR-055, partial)
- Income Statement and Balance Sheet exist
- Cash Flow Statement page missing
- **Impact**: Incomplete financial reporting

### 3. Bank & Cash Management (FR-058)
- No bank accounts, deposits, withdrawals, transfers, or reconciliation pages
- No API routes for bank operations
- **Impact**: Bank reconciliation not available

### 4. Tax Compliance Reports (FR-059)
- Tax rates exist in item settings
- No dedicated tax compliance reporting
- **Impact**: Missing tax compliance feature

### 5. HR Performance Records (FR-071)
- Employee profiles, attendance, payroll exist
- No training, achievements, or disciplinary record tracking
- **Impact**: Incomplete HR module

### 6. HR-Stock Integration (FR-073)
- No linking of employees to POS/warehouse operations
- **Impact**: Missing cross-module integration

## Partial Implementations

### Excel-like UX (FR-015, FR-047, FR-048)
- Fixed/sticky table headers: Implemented in `data-table.tsx` (sticky top-0)
- Adjustable column widths: Implemented via TanStack Table column resize (data-table.tsx L372-382)
- Drag-and-drop row reordering: Implemented in invoice items table via @dnd-kit (invoice-items-table.tsx)
- Adjustable row heights: NOT implemented (FR-048 partial gap)
- **Status**: Mostly implemented — only row height adjustment missing

### Autosave for Drafts (FR-014, FR-021, FR-049)
- Draft store exists (`stores/draft-store.ts`)
- Invoice form and journal entry form use autosave
- Not all draft-capable forms use autosave (payroll, expenses N/A)
- **Status**: Partially implemented

### Receipt Printing (FR-011)
- POS terminal exists
- Receipt generation/printing not implemented (TODO in code)
- **Status**: POS works but no receipts

### Accounting Activation Wizard (FR-061)
- Activation wizard component exists (`wizards/accounting-activation.tsx`)
- Historical data replay (FR-060) not verified
- **Status**: UI exists, backend integration unclear

### Payroll-Accounting Integration (FR-072)
- Payroll processing exists
- Auto-posting to accounting not verified
- **Status**: Both modules exist but integration unclear

## Build Health

- **Shared package**: Builds clean (0 errors)
- **Database package**: Builds clean (0 errors)
- **API CJS build**: Succeeds (uuid→crypto.randomUUID fix, cycle 2)
- **API DTS build**: Now succeeds (explicit Router/Express type annotations, cycle 3 iter 3)
- **API type-check**: 0 TypeScript errors (down from 435 at start, 100% reduction)
- **Web type-check**: 0 TypeScript errors (down from 188 first measured, 100% reduction)
- **Web build**: SSG prerender errors from useAuth (not TS errors — pages need dynamic rendering)
- **Tests**: 514 passing across 26 suites

### Error Progression
| Iteration | API Errors | Web Errors | Fix Applied |
|-----------|-----------|------------|-------------|
| Start | 435 | — | — |
| 3 (QA) | 415 | — | Removed rootDir, added validateRequest export |
| 7 (Arch) | 399 | — | Fixed BaseRepository generic type resolution |
| 9 (QA) | 342 | — | Added 19 missing table definitions |
| 13 (Arch) | 332 | — | Added missing AuditEntityType values |
| 15 (QA) | 170 | — | Added Relationships arrays + CompositeTypes + settings table |
| 17 (BA) | 156 | — | Expanded TenantSettings with company info + formatting |
| 18 (CR) | 138 | — | Added 7 missing RPC functions to database types |
| 19 (Arch) | 119 | — | Fixed POS module DI pattern + validate calls |
| 20 (FD) | — | 188 | Fixed corrupted template literals in web app |
| 21 (QA) | 106 | — | Fixed 13 TS7030 return-type errors in route handlers |
| 24 (CR) | 87 | — | Removed 19 unused variables/imports |
| 25 (Arch) | 67 | — | Fixed reports.routes.ts: DI constructors, method names |
| 26 (FD) | — | 124 | Disabled typedRoutes (incompatible with next-intl) |
| 27 (QA) | — | 95 | Fixed @repo/shared→@erp/shared, added 13 missing deps |
| C2-1 (Arch) | 55 | — | Replaced uuid with Node.js crypto.randomUUID() |
| C2-2 (FD) | — | 67 | Added pageCount/onPageChange/onSearchChange to DataTable |
| C2-3 (QA) | — | — | Added 20 unit tests for AppError + error middleware |
| C3-1 (Arch) | — | — | Replaced uuid with crypto.randomUUID() in web app |
| C3-2 (FD) | — | — | Added aria-labels + focus visibility to invoice items table |
| C3-3 (QA) | 55 | 67 | Fixed 24 TS2742 DTS build errors (API build now passes) |
| C3-4 (PM) | 55 | 67 | Updated gap analysis, elevated Account.children to P0 |
| C3-5 (BA) | — | — | Added draft auto-save indicator to invoice form |
| C3-6 (CR) | 46 | 65 | Fixed Account type: children field + parent_id null alignment |
| C3-7 (Arch) | 46 | 57 | Fixed User type confusion: currentUser for full_name/tenant |
| C3-8 (FD) | 46 | 53 | Added optional prices to ItemWithCategory |
| C3-9 (QA) | 46 | 52 | Added time_zone to TenantSettings |
| C3-10 (PM) | 46 | 51 | Narrowed date_format/number_format types in TenantSettings |
| C4-1 (Arch) | 46 | 31 | Fix type misalignment: use CustomerBalanceReportEntry in report PDF |
| C4-2 (FD) | 46 | 17 | Fix receipt snake→camelCase, react-pdf boolean style/numberOfLines |
| C4-3 (QA) | 46 | 8 | Fix api-client params type, audit-logs hook typing |
| C4-4 (PM) | 46 | 2 | Fix employee-form null values, journal-entry undefined debit/credit |
| C4-5 (BA) | 46 | 0 | Fix User→UserWithRole, contentRef→content |
| C4-6 (CR) | 38 | 0 | Fix party.service: mapRow, create args, result.data |
| C4-7 (Arch) | 32 | 0 | Fix journal-entry.repo: mapEntry, rename findAll/findById |
| C4-8 (FD) | 24 | 0 | Fix payroll: total_amount, settings cast, journal input |
| C4-9 (QA) | 15 | 0 | Fix payment.service, user.service: create args, mapRow |
| C4-10 (PM) | **0** | **0** | Fix pos.service (InvoiceService), all route/repo errors |

### Build Status: ALL CLEAR
- **API type-check**: 0 errors
- **API build**: Succeeds (CJS + DTS)
- **Web type-check**: 0 errors
- **Web build**: Succeeds (all pages prerender correctly)
- **Tests**: 514 passing (26 test suites: all 20 services + error middleware + auth middleware + validate middleware + tenant middleware + rate-limit middleware + base repository)

### Fixes Applied (Iterations 1–27, Cycle 2 Iterations 1–4)
- Package naming: `@erp-saas/*` → `@erp/*` (142+ imports aligned)
- 10 missing UI components created (Badge, AlertDialog, Skeleton, Switch, Alert, Popover, Command, Tooltip, Progress, RadioGroup)
- Toast notification system created
- Accessibility: sidebar aria labels, skip-to-content, keyboard nav
- Audit middleware: fixed Content-Type bug, sanitized sensitive data, added missing entity types
- Dashboard: replaced fake stats with onboarding guide
- HR Employees: replaced mock data with real API hook, fixed locale routing
- Database types: Relationships, CompositeTypes, settings table, 7 RPC functions
- TenantSettings: added company info, module toggles, formatting options
- POS module: fixed DI pattern, correct imports, validate calls
- Web app: fixed corrupted template literals in api-client and auth-provider
- Reports routes: fixed all 20 errors (wrong constructors, method names, type casts)
- Removed 19 unused variables/imports across 16 API files
- Disabled experimental typedRoutes (conflicted with next-intl [locale] routing)
- Created missing use-debounce hook
- Added 13 missing npm dependencies (date-fns, @react-pdf/renderer, @dnd-kit/*, etc.)
- **[C2]** Replaced uuid with Node.js built-in crypto.randomUUID() (unblocked API build)
- **[C2]** Added pageCount/pageIndex/onPageChange/onSearchChange to DataTable (fixed 28 web errors)
- **[C2]** Added 20 unit tests for AppError class + error/notFound/async handlers
- **[C3]** Replaced uuid with crypto.randomUUID() in web app (aligned with API approach)
- **[C3]** Added aria-labels to invoice items table (drag handle, delete, editable cells) + keyboard focus visibility
- **[C3]** Fixed 24 TS2742 DTS build errors: explicit Router/Express/query() type annotations — API build now fully passes
- **[C3]** Fixed Account type (children + parent_id null), User type confusion (currentUser), ItemWithCategory (prices), TenantSettings (time_zone, narrowed date/number formats)
- **[C3]** Added draft auto-save indicator to invoice form (UX improvement)
- **[C4]** Fixed customer-balances-report type: PartyBalanceSummary→CustomerBalanceReportEntry (20 errors eliminated), added isActive to report entry, fixed react-pdf boolean style/numberOfLines
- **[C4]** Fixed all 46 API errors: snake→camel mapRow() in services, BaseRepository.create() args, QueryResult.data, SelectQueryError casts, InvoiceService integration in POS, route type casts
- **[C4]** Fixed all 51 web errors: receipt camelCase, react-pdf styles, api-client params, audit-logs types, employee-form null, UserWithRole, useReactToPrint API
- **[C5]** Extracted ReportService from reports.routes.ts — enforced routes→services→repos layering
- **[C5]** Fixed keyboard accessibility: low-stock-config clickable span (role, tabIndex, keyDown), EditableCell Space key
- **[C5]** Added 33 unit tests for ReportService (calculateSummary, groupBy, generateCsv) — total 86 tests
- **[C5]** Restored and updated gap analysis with corrected FR-048 status (column resize implemented)
- **[C5]** Moved invoice validation alert above items section with contextual messages (UX)
- **[C5]** Fixed missing await on ReportService.applyFilters + CSV grouped-data bug
- **[C5]** Fixed roles route overly broad error handler leaking internal errors (security)
- **[C5]** Added ARIA labels: language selector, party search input, sort icons aria-hidden
- **[C5]** Added 20 unit tests for PaymentService — total 106 tests across 5 suites
- **[C6]** Created missing /payments/new page to fix dead Record Payment link (BA)
- **[C6]** Fixed overly broad error handlers in currencies and exchange-rates routes (security — same issue as roles fix)
- **[C6]** Added ARIA labels to image upload (file input, reorder/remove buttons) and return invoice dialog (quantity inputs, icons)
- **[C6]** Added 34 unit tests for AuditService (sanitizeValues, calculateDiff, extractContext, mapAuditLog) — total 140 tests across 6 suites
- **[C7]** Replaced fragile error.message.includes() with instanceof AccountingError in journal-entries routes (security)
- **[C8]** Deduplicated cn() utility: web app re-exports from @erp/ui instead of duplicating (architecture)
- **[C8]** Added aria-label to item selection buttons in invoice form Add Item dialog (accessibility)
- **[C8]** Added 27 unit tests for ItemService (ItemError, mapSortField, constructor, error codes) — total 167 tests across 7 suites
- **[C9]** Escaped ILIKE wildcards (%, _, \) in search queries across 7 repositories via BaseRepository.escapeILike() (security)
- **[C9]** Removed dead /invoices nav link from sidebar — redundant with Sales/Purchases (UX)
- **[C9]** Extracted CategoryService from categories routes to enforce service layer pattern (architecture)
- **[C9]** Added keyboard accessibility (role, tabIndex, aria-sort, onKeyDown) to virtualized data table sort headers (accessibility)
- **[C9]** Added 26 tests: CategoryService errors/guards (16) + BaseRepository.escapeILike (10) — total 193 tests across 9 suites
- **[C10]** Replaced ambiguous balance display with Owes/Credit labels in payment form party selector (UX)
- **[C10]** Fixed missed ILIKE wildcard escaping in employee and party search repositories (security)
- **[C10]** Extracted RoleService from roles routes to enforce service layer pattern (architecture)
- **[C10]** Replaced non-interactive div with semantic button for POS item search results (accessibility)
- **[C10]** Added 11 tests for RoleService (RoleError, error codes, constructor) — total 204 tests across 10 suites
- **[C11]** Removed tautological conditional in updatePartyBalance (code review)
- **[C11]** Extracted CurrencyService from currencies routes to enforce service layer pattern (architecture)
- **[C11]** Added aria-labels to journal entry form line inputs and delete button (accessibility)
- **[C11]** Added 13 unit tests for CurrencyService (CurrencyError, error codes, constructor) — total 217 tests across 11 suites
- **[C12]** Replaced broken estimatedReorderValue (always 0) with totalSuggestedReorderQty in low-stock report (code review)
- **[C12]** Extracted ExchangeRateService from exchange-rates routes — completes service layer pattern for all routes (architecture)
- **[C12]** Added focus-visible ring to dashboard quick action buttons for keyboard navigation (accessibility)
- **[C12]** Added 9 unit tests for ExchangeRateService (ExchangeRateError, error codes, constructor) — total 226 tests across 12 suites
- **[C12]** Removed misleading hardcoded 'Stock: 100' from POS item search results (UX)
- **[C13]** Extracted Supabase storage logic from ImageUpload into useImageUpload hook — restores separation of concerns (architecture)
- **[C13]** Fixed responsive overflow: party-select popover max-w-[calc(100vw-2rem)], journal entry table overflow-x-auto (accessibility/UX)
- **[C13]** Added 24 unit tests for PartyService (error codes, mapRow, mapSortField, constructor) — total 250 tests across 13 suites
- **[C13]** Updated gap analysis: 250 tests, cycle 13 progress documented
- **[C13]** Added confirmation dialog before invoice finalization — prevents accidental locks (UX)
- **[C13]** Rejected requests with missing tenant_id instead of defaulting to empty string (security)
- **[C13]** Replaced 15 'any' casts in ReportService with typed ReportInventoryEntry and ReportGroup (architecture/type safety)
- **[C13]** Added aria-labels to POS terminal cart buttons (decrease, increase, remove) with item name context (accessibility)
- **[C13]** Added 14 unit tests for WarehouseService (error codes, constructor, bulk result) — total 264 tests across 14 suites
- **[C14]** Added null check for session in auth login route before accessing tokens (security)
- **[C14]** Eliminated all remaining 'any' types from ReportService — zero any in entire file (type safety)
- **[C14]** Fixed employee form submit button showing double icon during loading state (UX)
- **[C14]** Added 19 unit tests for UserService (UserError, error codes, mapUser, constructor) — total 283 tests across 15 suites
- **[C14]** Updated gap analysis: 283 tests, cycle 14 progress documented
- **[C15]** Added critical low-stock alert banner on warehouse detail page — surfaces items below 25% threshold without tab switching (UX)
- **[C15]** Added requirePermission guards to all user management write endpoints: create, update, delete, activate, deactivate, change-password, role update (security — previously any authenticated user could modify any account)
- **[C15]** Replaced 'any' cast with typed JournalLineWithEntry interface in accounting general ledger (type safety)
- **[C15]** Fixed label-input association and added accessible loading state on trial balance page (accessibility)
- **[C15]** Added 15 unit tests for AccountingService (AccountingError, error codes, constructor) — total 298 tests across 16 suites
- **[C15]** Updated gap analysis: 298 tests, cycle 15 progress documented
- **[C16]** Added search by code/name to chart of accounts page — enables fast account lookup for large charts (UX)
- **[C16]** Added requirePermission guards to all invoice write/delete/finalize endpoints (security)
- **[C16]** Added requirePermission guards to payment routes and fixed unsafe 'as any' user extraction (security + type safety)
- **[C16]** Replaced 'any' cast with typed JournalLineWithEntry in accounting general ledger (type safety)
- **[C16]** Fixed label-input associations and accessible loading states on income statement and balance sheet pages (accessibility)
- **[C16]** Added 11 unit tests for EmployeeService (EmployeeError, error codes, constructor) — total 309 tests across 17 suites
- **[C16]** Updated gap analysis: 309 tests, cycle 16 progress documented
- **[Post-Loop]** Added requirePermission guards to warehouses, items, parties, transfers routes (security)
- **[Post-Loop]** Added 24 unit tests for AlertsService and AttendanceService — total 333 tests across 19 suites
- **[Post-Loop]** Added requirePermission guards to accounting, attendance, employees, categories routes (via agents)
- **[Post-Loop]** Added requirePermission guards to accounts, currencies, exchange-rates, journal-entries, payroll, pos, roles, settings routes — **ALL 22 route files now enforce permission-based authorization** (security)
- **[Post-Loop]** Added all new Permission types and labels: employees, attendance, journal_entries, payroll, pos, currencies, exchange_rates, accounts, categories (type safety)
- **[Post-Loop]** Added 42 unit tests for PayrollService, SettingsService, TransferService — **all 20 services now have test coverage** — total 375 tests across 22 suites
- **[Post-Loop-2]** Extracted routes barrel module (`routes/index.ts`) — app entry point reduced from 22 individual route imports to single `app.use('/api/v1', apiRoutes)` (architecture)
- **[Post-Loop-2]** Replaced 8 custom inline SVG icon components with lucide-react imports on dashboard page — 69 lines removed, consistency improved (frontend)
- **[Post-Loop-2]** Added 10 unit tests for POSService.validateDiscount (max limit, manager approval, threshold boundaries) — total 385 tests across 22 suites
- **[Post-Loop-2]** Fixed misleading stats cards on sales and purchases list pages: renamed "This Month" to "Page Total", added "Showing X of Y" (UX/data integrity)
- **[Post-Loop-2]** Fixed `.single()` → `.maybeSingle()` in party service for optional queries (getCustomerBalanceReport, validateEmailUniqueness) — prevents PGRST116 errors (bug fix)
- **[Post-Loop-2]** Removed redundant View/Edit dropdown actions on items page — both navigated to same URL (UX)
- **[Post-Loop-2]** Added 9 unit tests for requirePermission middleware (auth, wildcard, 403, multiple permissions) — total 394 tests across 23 suites
- **[Post-Loop-2]** Fixed misleading stats cards on employees and attendance pages: removed hardcoded "New This Month: 0", fixed duplicate present count (UX)
- **[Post-Loop-2]** Fixed last remaining `.single()` → `.maybeSingle()` calls in invoice.service.ts (inventory lookups, payment report invoice lookup, updatePartyBalance) — 7 total fixes across 3 services
- **[Post-Loop-2]** Added 10 unit tests for InvoiceService.mapRowToInvoice (snake→camel mapping, numeric conversion, null handling) — total 404 tests across 23 suites
- **[Post-Loop-2]** Removed misleading hardcoded mock data from payroll page — fake $45K/$43K payroll runs replaced with empty state (UX/data integrity)
- **[Post-Loop-2]** Fixed .single() → .maybeSingle() in payroll getOrCreate methods — 3 methods that look up accounts which may not exist yet (bug fix)
- **[Post-Loop-2]** Removed unnecessary 'as any' cast in payment.service.ts — validatePaymentType already accepts string (type safety)
- **[Post-Loop-2]** Fixed misleading transfer stats cards — added "Showing X of Y" and "on this page" labels (UX)
- **[Post-Loop-2]** Added 13 unit tests for validateRequest middleware (body/query/params validation, transformation, edge cases) — total 417 tests across 24 suites
- **[Post-Loop-2]** Fixed destructive onFocus behavior in journal entry debit/credit fields — clears opposite only on actual value input, not on focus (UX)
- **[Post-Loop-2]** Added missing error handling for admin role lookup in registration — prevents users without role assignment (security)
- **[Post-Loop-2]** Fixed .single() → .maybeSingle() in settings service — 3 tenant lookups (bug fix)
- **[Post-Loop-2]** Replaced hardcoded '-' stats on warehouses page with 'Showing X of Y' and 'Active on page' (UX)
- **[Post-Loop-2]** Added 9 unit tests for tenant middleware (tenantMiddleware + verifyTenantAccess) — total 426 tests across 25 suites
- **[Loop-3 C1]** Replaced mock data with real API hooks in purchases edit page — was using hardcoded MOCK_WAREHOUSES/PARTIES/ITEMS instead of useWarehouses/useParties/useItems (architecture)
- **[Loop-3 C1]** Fixed locale-less navigation across all 4 purchase pages — links now include /${locale}/ prefix (bug fix)
- **[Loop-3 C2]** Added keyboard accessibility to purchase list table rows — tabIndex, role="link", aria-label, Enter/Space key support (accessibility)
- **[Loop-3 C2]** Added aria-label to purchase search input, made detail page header responsive on mobile (accessibility/UX)
- **[Loop-3 C2]** Removed unused cn imports from purchases pages (cleanup)
- **[Loop-3 C3]** Added 10 unit tests for InvoiceService edge cases (negative qty, discount >100%, high tax, fractional qty, error codes) — total 436 tests across 25 suites
- **[Loop-3 C5]** Wired up Print/Export PDF buttons on purchase detail page using useReactToPrint + InvoicePdf (UX — buttons were non-functional)
- **[Loop-3 C6]** Fixed stale locale in useCallback deps on purchases/new and sales/new pages (bug fix)
- **[Loop-3 C7]** Applied same fixes to sales detail page: locale navigation, Print/PDF, responsive header, unused import (architecture consistency)
- **[Loop-3 C8]** Added keyboard accessibility to sales list page: tabIndex, role, aria-label, Enter/Space, prefetch on focus (accessibility)
- **[Loop-3 C9]** Added 13 unit tests for rate limiting middleware (rate limiter behavior, key generators) — total 449 tests across 26 suites
- **[Loop-3 C10]** Fixed broken locale-less navigation across entire warehouses module (bug fix)
- **[Loop-4 C1]** Fixed locale-less navigation across accounting journal, POS, and activation wizard modules — 6 files, 10 routes fixed (architecture/bug fix)
- **[Loop-4 C2]** Improved responsive layout on customers list page — header stacks on mobile, normalized container (accessibility/UX)
- **[Loop-4 C3]** Added 24 unit tests for ExchangeRateService methods (getRates, getRate, createRate, updateRate, deleteRate, getLatestRate, getRatesInRange) — total 473 tests across 26 suites
- **[Loop-4 C4]** Updated gap analysis: 473 tests across 26 suites (project manager)
- **[Loop-4 C5]** Fixed non-responsive header layout on suppliers list page — same responsive stacking pattern as customers (UX)
- **[Loop-4 C6]** Escaped ILIKE wildcards in category, invoice, and transfer search queries via BaseRepository.escapeILike() (security)
- **[Loop-4 C7]** Moved warehouse transfer filtering from client-side route to repository layer — added warehouseId to TransferQueryParams, eliminated JS-side filtering (architecture)
- **[Loop-4 C8]** Improved responsive layout on payments list page — header stacks on mobile (UX)
- **[Loop-4 C9]** Added 14 unit tests for SettingsService methods (getSettings, resetSettings, getCompanyInfo, toggleAccountingModule, toggleHRModule, getSetting) — total 487 tests across 26 suites
- **[Loop-4 C10]** Fixed last locale-less navigation in warehouses/transfers/page.tsx dropdown menu (bug fix); updated gap analysis to 487 tests
- **[Loop-4 C11]** Fixed non-responsive header on warehouses list page — 4 action buttons now wrap on mobile (UX)
- **[Loop-4 C12]** Added BaseRepository.assertUuid() to validate UUIDs before PostgREST .or() filter interpolation — prevents filter injection (security)
- **[Loop-4 C13]** Moved flattenTree from accounts route to AccountingService.getFlatChartOfAccounts — typed, eliminates last route-level business logic (architecture)
- **[Loop-4 C14]** Fixed responsive headers on sales and purchases list pages (UX)
- **[Loop-4 C15]** Added 8 unit tests for BaseRepository.assertUuid (valid, invalid, injection payloads) — total 495 tests across 26 suites
- **[Loop-4 C16]** Updated gap analysis: 495 tests, documented iterations 11-15
- **[Loop-4 C17]** Fixed non-responsive header on HR employees list page (UX)
- **[Loop-4 C18]** Replaced fragile error.message.includes() with instanceof AccountingError — 2 catch blocks, error: any→unknown (code review)
- **[Loop-4 C19]** Replaced 4 any types with Request and unknown in AuditService (type safety)
- **[Loop-4 C20]** Fixed responsive headers on HR payroll and attendance pages (UX)
- **[Loop-4 C21]** Added 3 unit tests for AccountingService.getFlatChartOfAccounts — total 498 tests across 26 suites
- **[Loop-4 C22]** Updated gap analysis: 498 tests, documented iterations 16-21
- **[Loop-4 C23]** Fixed last 3 non-responsive headers (accounts, journal, categories) — all list pages now mobile-ready (UX)
- **[Loop-4 C24]** Escaped ILIKE in party name/email lookups, made escapeILike public — zero unescaped ILIKE in codebase (security)
- **[Loop-4 C25]** Replaced any with Record<string, unknown> in user update builder (type safety)
- **[Loop-4 C26]** Fixed responsive header on settings users page (UX)
- **[Loop-4 C27]** QA clean pass — 498 tests pass, no issues found
- **[Loop-4 C28]** PM clean pass — gap analysis updated, all iterative fixes complete
- **[Loop-5 C1]** Replaced any[] with Account[] in accounting activation route (type safety)
- **[Loop-5 C2]** Fixed responsive header on settings audit-logs page (UX)
- **[Loop-5 C3]** Added 6 missing error code tests for PayrollService (CANNOT_DELETE) and InvoiceService (INVOICE_NOT_DRAFT, INVOICE_NO_ITEMS, INVOICE_NOT_FINAL, ITEMS_NOT_FOUND, INSUFFICIENT_STOCK) — total 504 tests
- **[Loop-5 C4]** Updated gap analysis: 504 tests, documented Loop 5 iterations 1-3
- **[Loop-5 C5]** Clamped POS discount input to 0-100% — JS enforcement was missing despite HTML min/max attributes (UX/bug fix)
- **[Loop-5 C6]** Added error handling to inventory mutations in applyStockMovements and reverseStockMovements — previously silent failures (bug fix)
- **[Loop-5 C7]** Replaced 7 any return types with Role in RoleService, added mapRow for DB→shared type mapping (type safety)
- **[Loop-5 C8]** Fixed responsive header on settings currencies page (UX)
- **[Loop-5 C9]** Added 10 missing error code tests for PaymentService and AuditService — total 514 tests

## Recommendations (Priority Order)

1. **P0**: ~~Fix type errors~~ **DONE** — 0 API errors, 0 web errors
2. **P1**: ~~Fix Next.js SSG prerender errors~~ **DONE** — all pages prerender correctly
3. **P2**: Implement Expenses module (FR-032–034) — only entirely missing user story
4. **P3**: Implement Cash Flow Statement page
5. **P3**: Add receipt printing to POS terminal
6. **P3**: Add Bank & Cash Management module
7. **P3**: ~~Add adjustable columns to data tables~~ **DONE** — column resize implemented via TanStack Table
8. **P3**: Add adjustable row heights to data tables (FR-048 remaining gap)
