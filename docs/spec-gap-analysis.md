# Spec Gap Analysis — 001-modular-erp-saas

Reviewed against: `specs/001-modular-erp-saas/spec.md`
Date: 2026-03-03 | Reviewer: Project Manager (Ralph Loop Cycle 5, Iteration 4; 0 API + 0 Web TS errors)

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
- **Tests**: 20 passing (API error middleware)

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
- **Tests**: 106 passing (5 test suites: error middleware, invoice, POS, report, payment services)

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

## Recommendations (Priority Order)

1. **P0**: ~~Fix type errors~~ **DONE** — 0 API errors, 0 web errors
2. **P1**: ~~Fix Next.js SSG prerender errors~~ **DONE** — all pages prerender correctly
3. **P2**: Implement Expenses module (FR-032–034) — only entirely missing user story
4. **P3**: Implement Cash Flow Statement page
5. **P3**: Add receipt printing to POS terminal
6. **P3**: Add Bank & Cash Management module
7. **P3**: ~~Add adjustable columns to data tables~~ **DONE** — column resize implemented via TanStack Table
8. **P3**: Add adjustable row heights to data tables (FR-048 remaining gap)
