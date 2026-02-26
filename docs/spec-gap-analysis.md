# Spec Gap Analysis — 001-modular-erp-saas

Reviewed against: `specs/001-modular-erp-saas/spec.md`
Date: 2026-02-26 | Reviewer: Project Manager (Ralph Loop Iteration 4)

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

- **Shared package**: Builds successfully
- **Database package**: Builds successfully
- **API type-check**: 415 TypeScript errors (pre-existing, reduced from 435)
- **Web app**: Missing Radix dependencies added; 4 missing UI components created

## Recommendations (Priority Order)

1. **P1**: Implement Expenses module (FR-032–034) — only entirely missing user story
2. **P1**: Fix remaining 415 API type errors to unblock backend builds
3. **P2**: Implement Cash Flow Statement page
4. **P2**: Add receipt printing to POS terminal
5. **P3**: Add Bank & Cash Management module
6. **P3**: Add adjustable columns and drag-and-drop to data tables
7. **P3**: Add HR performance records tracking
