# Implementation Plan: Modular ERP SaaS Platform

**Branch**: `001-modular-erp-saas` | **Date**: 2025-12-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-modular-erp-saas/spec.md`

---

## Summary

Build a modular ERP SaaS platform with Stock Management as the core MVP (Items, Warehouses, POS, Sales, Purchases, Customers/Suppliers, Expenses), and optional Accounting and HR add-on modules. The system uses Next.js 14 + shadcn/ui frontend, Node.js + Express backend, Supabase for database/auth with RLS-based multi-tenancy, and Stripe for subscriptions. Key UX features include Excel-like tables, local autosave for drafts, Arabic/English with RTL support, and dark/light themes.

---

## Technical Context

**Language/Version**: TypeScript 5.x (both frontend and backend)
**Frontend Framework**: Next.js 14 (App Router) + shadcn/ui + Tailwind CSS
**Backend Framework**: Node.js 20 + Express.js
**Database**: Supabase (PostgreSQL with Row-Level Security)
**Authentication**: Supabase Auth (email/password + social providers)
**Payments**: Stripe (subscriptions, invoices)
**PDF Generation**: @react-pdf/renderer (client-side only)
**Testing**: Vitest (unit), Playwright (E2E), Supertest (API)
**Target Platform**: Cloud-hosted SaaS (browser-based)
**Project Type**: Web application (monorepo)
**Performance Goals**: 100 concurrent users/tenant, <2s table loads for 10k records
**Constraints**: 99.5% uptime, RTL support, offline draft autosave
**Scale/Scope**: Multi-tenant SaaS with 3 modules, ~50 screens

---

## Constitution Check

*GATE: Constitution template not yet customized for this project. Using default best practices:*

| Principle | Status | Notes |
|-----------|--------|-------|
| Test-First | PLANNED | Unit tests for services, integration tests for APIs, E2E for critical flows |
| Library-First | ADAPTED | Monorepo packages for shared code (types, UI, database) |
| Security | PLANNED | Supabase RLS for tenant isolation, JWT auth, input validation |
| Simplicity | PLANNED | REST over GraphQL, Zustand over Redux, minimal abstractions |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-modular-erp-saas/
├── spec.md              # Feature specification (COMPLETE)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
erp-saas/
├── apps/
│   ├── web/                      # Next.js 14 Frontend
│   │   ├── app/[locale]/         # i18n App Router
│   │   │   ├── (auth)/           # Login, Register, Forgot Password
│   │   │   └── (dashboard)/      # Main application
│   │   │       ├── items/
│   │   │       ├── warehouses/
│   │   │       ├── sales/
│   │   │       ├── purchases/
│   │   │       ├── customers/
│   │   │       ├── suppliers/
│   │   │       ├── expenses/
│   │   │       ├── reports/
│   │   │       └── settings/
│   │   ├── components/
│   │   │   ├── ui/               # shadcn components
│   │   │   ├── layout/           # Sidebar, Header
│   │   │   ├── tables/           # DataTable (Excel-like)
│   │   │   └── forms/            # AutosaveForm, SearchableSelect
│   │   ├── hooks/
│   │   ├── stores/               # Zustand (drafts, UI state)
│   │   ├── locales/              # en/, ar/
│   │   └── lib/
│   │
│   └── api/                      # Express.js Backend
│       ├── src/
│       │   ├── routes/           # REST endpoints
│       │   ├── services/         # Business logic
│       │   ├── middleware/       # Auth, tenant, rate-limit
│       │   └── repositories/     # Data access
│       └── tests/
│
├── packages/
│   ├── shared/                   # Types, validation schemas, constants
│   ├── ui/                       # Extended UI components
│   └── database/                 # Supabase client, migrations, RLS
│
├── turbo.json
└── pnpm-workspace.yaml
```

**Structure Decision**: Monorepo with Turborepo - shared TypeScript types eliminate API contract drift, single CI/CD pipeline.

---

## Key Technical Decisions

### 1. Monorepo with Turborepo
- Shared types between frontend/backend prevent API mismatches
- Single version control simplifies deployment
- Turborepo caching speeds up builds

### 2. State Management: Zustand + TanStack Query
- **Zustand**: Local state (drafts, theme, language) - lightweight, simple API
- **TanStack Query**: Server state with caching, optimistic updates, real-time sync

### 3. API Design: REST with OpenAPI
- Simpler than GraphQL for mostly CRUD operations
- OpenAPI provides documentation and type generation
- Better caching and rate limiting per endpoint

### 4. Multi-Tenancy: Shared DB with Supabase RLS
- Most cost-effective for SaaS with many small tenants
- Database-level security, not just application-level
- All tables include `tenant_id` column with RLS policies

### 5. Feature Flags: Database-Driven
- Modules (Accounting, HR) enabled/disabled per tenant
- Subscription limits enforced at runtime
- Stored in tenant settings with in-memory cache

### 6. i18n: next-intl
- Built for Next.js App Router
- Supports RTL layout switching
- Type-safe with ICU message format

### 7. PDF Generation: Client-Side
- @react-pdf/renderer for all reports
- Large reports paginated client-side with progress indicator

---

## Implementation Phases

### Phase 0: Project Setup
- Initialize monorepo with Turborepo + pnpm
- Configure Next.js 14, Express.js, TypeScript
- Set up Supabase project (auth, database)
- Configure Tailwind CSS + shadcn/ui with brand palette
- Set up CI/CD with GitHub Actions
- Create initial database migrations

### Phase 1: Authentication & Multi-tenancy
- Implement Supabase Auth integration
- Create tenant signup flow
- Implement RLS policies for all tables
- Build login/register pages
- Create dashboard layout (Sidebar, Header)

### Phase 2: Items & Inventory (User Stories 1, 4)
- Items CRUD with DataTable
- Image upload to Supabase Storage
- Bulk price updates
- Warehouse management
- Stock transfers
- Low stock alerts

### Phase 3: Sales & Purchases (User Stories 2, 3, 6)
- Invoice form with local autosave
- Excel-like item list component
- Real-time stock preview
- Customer/Supplier selection with balance
- Invoice finalization and returns
- Payment recording

### Phase 4: POS & Expenses (User Stories 5, 7)
- POS location configuration
- Quick sale interface
- Receipt generation
- Expense entry and reports

### Phase 5: Localization & Theming (User Story 8)
- Arabic/English translations
- RTL layout adjustments
- Dark/light theme toggle
- Currency and exchange rate management

### Phase 6: Reports & PDF Export
- Sales, Purchase, Inventory reports
- Customer/Supplier balance reports
- PDF generation for all reports

### Phase 7: Subscription & Limits
- Stripe subscription integration
- Freemium limits enforcement (50 items, 1 user, 25 tx/month)
- Upgrade flow

### Phase 8: Admin & Audit Logging
- Audit log implementation
- Admin dashboard
- RBAC refinement

### Phase 9 (Optional): Accounting Module
- Chart of accounts, Journal entries
- Auto-generation from Stock transactions
- Financial statements
- Activation wizard

### Phase 10 (Optional): HR Module
- Employee management
- Attendance/Leave tracking
- Payroll processing
- Integration with Accounting

---

## Critical Files

| File | Purpose |
|------|---------|
| `specs/001-modular-erp-saas/spec.md` | Source of truth - 73 FRs, 10 user stories |
| `apps/api/src/middleware/tenant.ts` | Multi-tenancy middleware, tenant_id injection |
| `apps/web/components/tables/data-table.tsx` | Excel-like table (fixed headers, resize, virtualization) |
| `apps/web/stores/draft-store.ts` | Local autosave for invoices/purchases |
| `packages/database/migrations/001_initial_schema.sql` | Database schema with RLS policies |

---

## Complexity Tracking

> No constitution violations identified requiring justification.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| RLS policy complexity | Extensive testing, security audit, query analysis |
| RTL layout issues | Early RTL testing, Arabic-speaking testers |
| Excel-like table performance | Virtualization (TanStack Virtual), pagination |
| Local autosave conflicts | Last-write-wins with conflict notification |
| Stripe webhook failures | Retry logic, manual reconciliation dashboard |
