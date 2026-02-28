# Spec Gap Analysis — 001-modular-erp-saas

Reviewed against: `specs/001-modular-erp-saas/spec.md`
Date: 2026-02-27 | Reviewer: Project Manager (Ralph Loop Iteration 4, cycle 2; prev: Iteration 28)

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
| UX Requirements | FR-047–049 | 1 | 2 | 0 |
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
- Fixed/sticky table headers: Implemented in `data-table.tsx`
- Adjustable column widths: NOT implemented
- Drag-and-drop row reordering: NOT implemented
- **Status**: Basic table UX only

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
- **API CJS build**: Now succeeds (uuid→crypto.randomUUID fix, cycle 2 iter 1)
- **API type-check**: 55 TypeScript errors (down from 435 at start, 87% reduction)
- **Web app**: 67 TypeScript errors (down from 188 first measured, 64% reduction)
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

### Top Remaining API Errors (55 total, by file)
| File | Errors | Root Cause |
|------|--------|------------|
| services/party.service.ts | 8 | Type mismatches with database schema |
| services/payroll.service.ts | 7 | Type mismatches with database schema |
| repositories/journal-entry.repository.ts | 7 | JournalEntry type vs DB row shape mismatch |
| repositories/account.repository.ts | 6 | Account type vs DB row shape (parent_id, children) |
| services/payment.service.ts | 5 | Payment relation query types |
| services/user.service.ts | 4 | User type mismatches |
| services/pos.service.ts | 4 | POSLocationSettings JSON type |
| services/accounting.service.ts | 3 | Accounting integration types |
| routes (5 files) | 6 | Misc route handler types |
| middleware/validate.ts | 1 | Request→Record cast |
| repositories (4 files) | 4 | Schema type mismatches |

### Top Remaining Web Errors (67 total, by file)
| File | Errors | Root Cause |
|------|--------|------------|
| reports/customer-balances-report.tsx | 20 | PartyBalanceSummary missing fields |
| app/[locale] pages (8 files) | 13 | Missing type fields (children, prices, full_name) |
| reports/receipt.tsx | 8 | React-PDF API mismatches |
| layout/header.tsx | 5 | User type missing full_name, role, tenant |
| hooks (4 files) | 8 | API response type mismatches |
| reports/payments-report.tsx | 4 | React-PDF API mismatches |
| forms/employee-form.tsx | 4 | null vs undefined in form values |
| reports/items-report.tsx | 2 | React-PDF API mismatches |
| forms/journal-entry-form.tsx | 2 | Possibly undefined debit/credit |

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

## Recommendations (Priority Order)

1. **P1**: Fix `PartyBalanceSummary` type (20 web errors in one file)
2. **P1**: Fix `User` type — add full_name, role, tenant (10 web errors across header + pages)
3. **P1**: Fix remaining 55 API type errors (top: party.service 8, payroll.service 7, journal-entry.repo 7)
4. **P2**: Fix React-PDF report components (14 errors — receipt, items, payments reports)
5. **P2**: Fix `ItemWithCategory` missing `prices` field (4 errors in POS/sales/purchases)
6. **P2**: Implement Expenses module (FR-032–034) — only entirely missing user story
7. **P3**: Implement Cash Flow Statement page
8. **P3**: Add receipt printing to POS terminal
9. **P3**: Add Bank & Cash Management module
10. **P3**: Add adjustable columns and drag-and-drop to data tables
