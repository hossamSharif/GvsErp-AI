# Tasks: Modular ERP SaaS Platform

**Input**: Design documents from `/specs/001-modular-erp-saas/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, quickstart.md, contracts/openapi.yaml

**Tests**: Not explicitly requested - test tasks omitted (add TDD approach if needed later)

**Organization**: Tasks grouped by user story for independent implementation and testing

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- All paths relative to repository root

## Path Conventions (Monorepo)

- **Frontend**: `apps/web/`
- **Backend**: `apps/api/`
- **Shared Types**: `packages/shared/`
- **UI Components**: `packages/ui/`
- **Database**: `packages/database/`

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Initialize monorepo structure and configure tooling

- [X] T001 Create monorepo root with pnpm-workspace.yaml and turbo.json
- [X] T002 [P] Initialize packages/shared with TypeScript config in packages/shared/package.json
- [X] T003 [P] Initialize packages/database with Supabase client in packages/database/package.json
- [X] T004 [P] Initialize packages/ui for extended components in packages/ui/package.json
- [X] T005 Create Next.js 14 app with App Router in apps/web/
- [X] T006 Create Express.js API server in apps/api/
- [X] T007 [P] Configure ESLint and Prettier at monorepo root
- [X] T008 [P] Configure TypeScript paths and references in tsconfig.json
- [X] T009 [P] Create .env.example files for apps/web and apps/api
- [X] T010 Configure Tailwind CSS with brand palette in apps/web/tailwind.config.ts
- [X] T011 Initialize shadcn/ui with custom theme in apps/web/src/styles/globals.css
- [X] T012 [P] Add core shadcn components (button, card, input, label, table, dialog, dropdown-menu, form, select, tabs, toast)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**CRITICAL**: No user story work can begin until this phase is complete

### Database Schema & Migrations

- [ ] T013 Create initial migration with tenant, user, role tables in packages/database/migrations/001_core_schema.sql
- [ ] T014 Create RLS policies for tenant isolation in packages/database/migrations/002_rls_policies.sql
- [ ] T015 [P] Create database types generation script in packages/database/scripts/generate-types.ts
- [ ] T016 Create Supabase client wrapper with auth in packages/database/src/client.ts

### Shared Types & Validation

- [ ] T017 [P] Define core entity types (Tenant, User, Role) in packages/shared/src/types/core.ts
- [ ] T018 [P] Define API response types (pagination, error) in packages/shared/src/types/api.ts
- [ ] T019 [P] Create Zod validation schemas for auth in packages/shared/src/validation/auth.ts
- [ ] T020 [P] Define permission constants and role defaults in packages/shared/src/constants/permissions.ts

### Backend Infrastructure

- [ ] T021 Setup Express app with middleware (cors, helmet, json) in apps/api/src/index.ts
- [ ] T022 Create auth middleware with Supabase JWT verification in apps/api/src/middleware/auth.ts
- [ ] T023 Create tenant middleware for tenant_id injection in apps/api/src/middleware/tenant.ts
- [ ] T024 [P] Create error handling middleware in apps/api/src/middleware/error.ts
- [ ] T025 [P] Create request validation middleware using Zod in apps/api/src/middleware/validate.ts
- [ ] T026 [P] Create rate limiting middleware in apps/api/src/middleware/rate-limit.ts
- [ ] T027 Create base repository class with tenant filtering in apps/api/src/repositories/base.repository.ts

### Frontend Infrastructure

- [ ] T028 Setup TanStack Query provider in apps/web/src/providers/query-provider.tsx
- [ ] T029 Create Supabase auth provider in apps/web/src/providers/auth-provider.tsx
- [ ] T030 [P] Create API client with auth headers in apps/web/src/lib/api-client.ts
- [ ] T031 [P] Configure next-intl with AR/EN locales in apps/web/src/i18n/
- [ ] T032 Create theme provider (dark/light) with Zustand in apps/web/src/stores/theme-store.ts
- [ ] T033 [P] Create language store with RTL support in apps/web/src/stores/language-store.ts

### Auth Routes & Pages

- [ ] T034 Implement POST /auth/login endpoint in apps/api/src/routes/auth.routes.ts
- [ ] T035 Implement POST /auth/register endpoint with tenant creation in apps/api/src/routes/auth.routes.ts
- [ ] T036 Create login page in apps/web/src/app/[locale]/(auth)/login/page.tsx
- [ ] T037 Create register page in apps/web/src/app/[locale]/(auth)/register/page.tsx
- [ ] T038 Create auth layout with language switcher in apps/web/src/app/[locale]/(auth)/layout.tsx

### Dashboard Layout

- [ ] T039 Create dashboard layout with sidebar in apps/web/src/app/[locale]/(dashboard)/layout.tsx
- [ ] T040 [P] Create sidebar navigation component in apps/web/src/components/layout/sidebar.tsx
- [ ] T041 [P] Create header with user menu, theme toggle in apps/web/src/components/layout/header.tsx
- [ ] T042 Create dashboard home page in apps/web/src/app/[locale]/(dashboard)/page.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Manage Inventory Items (Priority: P1) - MVP

**Goal**: Define and manage inventory items with names, barcodes, prices, images, categories

**Independent Test**: Create, edit, search, bulk-update items; generate item PDF report

### Database & Types

- [X] T043 [P] [US1] Create Item, ItemPrice, ItemPackaging, Category tables migration in packages/database/migrations/003_items_schema.sql
- [X] T044 [P] [US1] Define Item entity types in packages/shared/src/types/items.ts
- [X] T045 [P] [US1] Create Zod validation schemas for items in packages/shared/src/validation/items.ts

### Backend - Items API

- [X] T046 [US1] Create ItemRepository with CRUD operations in apps/api/src/repositories/item.repository.ts
- [X] T047 [US1] Create CategoryRepository in apps/api/src/repositories/category.repository.ts
- [X] T048 [US1] Create ItemService with business logic in apps/api/src/services/item.service.ts
- [X] T049 [US1] Implement GET /items with pagination, search, filters in apps/api/src/routes/items.routes.ts
- [X] T050 [US1] Implement POST /items (create item) in apps/api/src/routes/items.routes.ts
- [X] T051 [US1] Implement GET /items/:id in apps/api/src/routes/items.routes.ts
- [X] T052 [US1] Implement PUT /items/:id (update) in apps/api/src/routes/items.routes.ts
- [X] T053 [US1] Implement DELETE /items/:id (soft delete) in apps/api/src/routes/items.routes.ts
- [X] T054 [US1] Implement POST /items/bulk-price-update in apps/api/src/routes/items.routes.ts
- [X] T055 [P] [US1] Implement GET /categories and POST /categories in apps/api/src/routes/categories.routes.ts

### Frontend - Items UI

- [X] T056 [US1] Create useItems hook with TanStack Query in apps/web/src/hooks/use-items.ts
- [X] T057 [US1] Create DataTable component with TanStack Table in apps/web/src/components/tables/data-table.tsx
- [X] T058 [US1] Add fixed headers, column resize, virtualization to DataTable in apps/web/src/components/tables/data-table-virtualized.tsx
- [X] T059 [US1] Create items list page with DataTable in apps/web/src/app/[locale]/(dashboard)/items/page.tsx
- [X] T060 [US1] Create item form component in apps/web/src/components/forms/item-form.tsx
- [X] T061 [US1] Create new item page in apps/web/src/app/[locale]/(dashboard)/items/new/page.tsx
- [X] T062 [US1] Create edit item page in apps/web/src/app/[locale]/(dashboard)/items/[id]/page.tsx
- [X] T063 [US1] Create bulk price update dialog in apps/web/src/components/dialogs/bulk-price-dialog.tsx
- [X] T064 [P] [US1] Create category management UI in apps/web/src/app/[locale]/(dashboard)/items/categories/page.tsx
- [X] T065 [P] [US1] Create image upload component with Supabase Storage in apps/web/src/components/forms/image-upload.tsx

### Reports - Items

- [X] T066 [US1] Create items report PDF template with @react-pdf/renderer in apps/web/src/components/reports/items-report.tsx
- [X] T067 [US1] Add PDF export button to items list page (apps/web/src/app/[locale]/(dashboard)/items/report/page.tsx)

**Checkpoint**: User Story 1 complete - Items management fully functional

---

## Phase 4: User Story 2 - Create and Manage Sales Invoices (Priority: P1)

**Goal**: Create sales invoices with real-time stock preview, customer selection, autosave

**Independent Test**: Create draft/final/returned invoices with customer linking

### Database & Types

- [X] T068 [P] [US2] Create Invoice, InvoiceItem tables migration in packages/database/migrations/004_invoices_schema.sql
- [X] T069 [P] [US2] Define Invoice entity types in packages/shared/src/types/invoices.ts
- [X] T070 [P] [US2] Create Zod validation schemas for invoices in packages/shared/src/validation/invoices.ts

### Backend - Sales API

- [X] T071 [US2] Create InvoiceRepository in apps/api/src/repositories/invoice.repository.ts
- [X] T072 [US2] Create InvoiceService with stock calculations in apps/api/src/services/invoice.service.ts
- [X] T073 [US2] Implement GET /invoices with filters in apps/api/src/routes/invoices.routes.ts
- [X] T074 [US2] Implement POST /invoices (create) in apps/api/src/routes/invoices.routes.ts
- [X] T075 [US2] Implement GET /invoices/:id in apps/api/src/routes/invoices.routes.ts
- [X] T076 [US2] Implement PUT /invoices/:id (update draft) in apps/api/src/routes/invoices.routes.ts
- [X] T077 [US2] Implement POST /invoices/:id/finalize in apps/api/src/routes/invoices.routes.ts
- [X] T078 [US2] Implement POST /invoices/:id/return in apps/api/src/routes/invoices.routes.ts
- [X] T079 [US2] Add invoice number auto-generation (SAL-YYYYMM-XXXX) in apps/api/src/services/invoice.service.ts

### Frontend - Sales UI

- [X] T080 [US2] Create draft autosave store with Zustand persist in apps/web/src/stores/draft-store.ts
- [X] T081 [US2] Create useInvoices hook in apps/web/src/hooks/use-invoices.ts
- [X] T082 [US2] Create Excel-like invoice item list component in apps/web/src/components/tables/invoice-items-table.tsx
- [X] T083 [US2] Add drag-drop reorder, inline editing to invoice items table
- [X] T084 [US2] Create searchable customer dropdown with balance preview in apps/web/src/components/forms/party-select.tsx
- [X] T085 [US2] Create sales invoice form with autosave in apps/web/src/components/forms/invoice-form.tsx
- [X] T086 [US2] Create sales list page in apps/web/src/app/[locale]/(dashboard)/sales/page.tsx
- [X] T087 [US2] Create new sale page in apps/web/src/app/[locale]/(dashboard)/sales/new/page.tsx
- [X] T088 [US2] Create edit sale page in apps/web/src/app/[locale]/(dashboard)/sales/[id]/page.tsx
- [X] T089 [US2] Create return invoice dialog in apps/web/src/components/dialogs/return-invoice-dialog.tsx
- [X] T090 [US2] Add real-time stock availability display in invoice item selection

### Reports - Sales

- [X] T091 [US2] Create sales report endpoint GET /reports/sales in apps/api/src/routes/reports.routes.ts
- [X] T092 [US2] Create sales report PDF template in apps/web/src/components/reports/sales-report.tsx
- [X] T093 [US2] Create sales invoice PDF template in apps/web/src/components/reports/invoice-pdf.tsx

**Checkpoint**: User Story 2 complete - Sales invoices fully functional

---

## Phase 5: User Story 3 - Process Purchase Orders (Priority: P1)

**Goal**: Create purchase orders with supplier selection, stock preview, autosave

**Independent Test**: Create purchase orders, final purchases, and returns

### Backend - Purchases API

- [X] T094 [US3] Extend InvoiceService for purchase type logic in apps/api/src/services/invoice.service.ts
- [X] T095 [US3] Add purchase-specific validation (stock increases on finalize) in apps/api/src/services/invoice.service.ts
- [X] T096 [US3] Add invoice number format for purchases (PUR-YYYYMM-XXXX)

### Frontend - Purchases UI

- [X] T097 [US3] Create searchable supplier dropdown with balance preview in apps/web/src/components/forms/party-select.tsx
- [X] T098 [US3] Create purchases list page in apps/web/src/app/[locale]/(dashboard)/purchases/page.tsx
- [X] T099 [US3] Create new purchase page in apps/web/src/app/[locale]/(dashboard)/purchases/new/page.tsx
- [X] T100 [US3] Create edit purchase page in apps/web/src/app/[locale]/(dashboard)/purchases/[id]/page.tsx
- [X] T101 [US3] Add current stock levels display in purchase item selection

### Reports - Purchases

- [X] T102 [US3] Create purchase report PDF template in apps/web/src/components/reports/purchase-report.tsx

**Checkpoint**: User Story 3 complete - Purchase orders fully functional

---

## Phase 6: User Story 4 - Manage Warehouses and Stock Transfers (Priority: P2)

**Goal**: Create warehouses, transfer stock between locations, low stock alerts

**Independent Test**: Create warehouses, transfer stock, configure and receive alerts

### Database & Types

- [X] T103 [P] [US4] Create Warehouse, Inventory, Transfer, TransferItem tables migration in packages/database/migrations/005_warehouse_schema.sql
- [X] T104 [P] [US4] Define Warehouse, Inventory, Transfer types in packages/shared/src/types/warehouse.ts
- [X] T105 [P] [US4] Create Zod validation schemas in packages/shared/src/validation/warehouse.ts

### Backend - Warehouse API

- [X] T106 [US4] Create WarehouseRepository in apps/api/src/repositories/warehouse.repository.ts
- [X] T107 [US4] Create InventoryRepository in apps/api/src/repositories/inventory.repository.ts
- [X] T108 [US4] Create TransferRepository in apps/api/src/repositories/transfer.repository.ts
- [X] T109 [US4] Create WarehouseService with value calculations in apps/api/src/services/warehouse.service.ts
- [X] T110 [US4] Create TransferService with stock movement logic in apps/api/src/services/transfer.service.ts
- [X] T111 [US4] Implement GET /warehouses in apps/api/src/routes/warehouses.routes.ts
- [X] T112 [US4] Implement POST /warehouses in apps/api/src/routes/warehouses.routes.ts
- [X] T113 [US4] Implement GET /warehouses/:id/inventory in apps/api/src/routes/warehouses.routes.ts
- [X] T114 [US4] Implement POST /transfers and GET /transfers in apps/api/src/routes/transfers.routes.ts
- [X] T115 [US4] Implement POST /transfers/:id/complete in apps/api/src/routes/transfers.routes.ts
- [X] T116 [US4] Create low stock alert checker service in apps/api/src/services/alerts.service.ts

### Frontend - Warehouse UI

- [X] T117 [US4] Create useWarehouses hook in apps/web/src/hooks/use-warehouses.ts
- [X] T118 [US4] Create warehouses list page in apps/web/src/app/[locale]/(dashboard)/warehouses/page.tsx
- [X] T119 [US4] Create warehouse detail page with inventory in apps/web/src/app/[locale]/(dashboard)/warehouses/[id]/page.tsx
- [X] T120 [US4] Create transfer form component in apps/web/src/components/forms/transfer-form.tsx
- [X] T121 [US4] Create transfers list page in apps/web/src/app/[locale]/(dashboard)/warehouses/transfers/page.tsx
- [X] T122 [US4] Create low stock alert configuration UI in apps/web/src/components/forms/low-stock-config.tsx
- [X] T123 [US4] Add low stock badge/indicator in inventory views

### Reports - Inventory

- [X] T124 [US4] Create inventory report endpoint GET /reports/inventory in apps/api/src/routes/reports.routes.ts
- [X] T125 [US4] Create inventory report PDF template in apps/web/src/components/reports/inventory-report.tsx

**Checkpoint**: User Story 4 complete - Warehouses and transfers functional

---

## Phase 7: User Story 5 - Manage Point of Sale Locations (Priority: P2)

**Goal**: Setup POS locations with receipt printing, discounts, promotions

**Independent Test**: Configure POS locations, process POS transactions with discounts

### Database & Types

- [X] T126 [P] [US5] Create POSLocation table migration in packages/database/migrations/006_pos_schema.sql
- [X] T127 [P] [US5] Define POSLocation types in packages/shared/src/types/pos.ts

### Backend - POS API

- [X] T128 [US5] Create POSLocationRepository in apps/api/src/repositories/pos.repository.ts
- [X] T129 [US5] Create POSService in apps/api/src/services/pos.service.ts
- [X] T130 [US5] Implement CRUD endpoints for POS locations in apps/api/src/routes/pos.routes.ts
- [X] T131 [US5] Implement quick sale endpoint POST /pos/:id/sale in apps/api/src/routes/pos.routes.ts

### Frontend - POS UI

- [X] T132 [US5] Create POS locations management page in apps/web/src/app/[locale]/(dashboard)/pos/page.tsx
- [X] T133 [US5] Create POS terminal interface in apps/web/src/app/[locale]/(dashboard)/pos/[id]/terminal/page.tsx
- [X] T134 [US5] Create receipt template component in apps/web/src/components/reports/receipt.tsx
- [X] T135 [US5] Add discount/promotion application logic to POS terminal
- [X] T136 [P] [US5] Create loyalty program configuration UI in apps/web/src/components/forms/loyalty-config.tsx

**Checkpoint**: User Story 5 complete - POS locations functional

---

## Phase 8: User Story 6 - Manage Customers, Suppliers, and Payments (Priority: P2)

**Goal**: Manage parties with auto-updating balances and payment recording

**Independent Test**: Create parties, record payments, view balance reports

### Database & Types

- [X] T137 [P] [US6] Create Party, Payment tables migration in packages/database/migrations/007_parties_schema.sql
- [X] T138 [P] [US6] Define Party, Payment types in packages/shared/src/types/parties.ts
- [X] T139 [P] [US6] Create Zod validation schemas in packages/shared/src/validation/parties.ts

### Backend - Parties & Payments API

- [X] T140 [US6] Create PartyRepository in apps/api/src/repositories/party.repository.ts
- [X] T141 [US6] Create PaymentRepository in apps/api/src/repositories/payment.repository.ts
- [X] T142 [US6] Create PartyService with balance calculations in apps/api/src/services/party.service.ts
- [X] T143 [US6] Create PaymentService in apps/api/src/services/payment.service.ts
- [X] T144 [US6] Implement GET /parties with type filter in apps/api/src/routes/parties.routes.ts
- [X] T145 [US6] Implement POST /parties in apps/api/src/routes/parties.routes.ts
- [X] T146 [US6] Implement PUT /parties/:id in apps/api/src/routes/parties.routes.ts
- [X] T147 [US6] Implement GET /payments and POST /payments in apps/api/src/routes/payments.routes.ts
- [X] T148 [US6] Wire party balance updates to invoice finalization (handled by database triggers in 007_parties_schema.sql)

### Frontend - Parties & Payments UI

- [X] T149 [US6] Create useParties hook in apps/web/src/hooks/use-parties.ts
- [X] T149.1 [US6] Create usePayments hook in apps/web/src/hooks/use-payments.ts
- [X] T150 [US6] Create customers list page in apps/web/src/app/[locale]/(dashboard)/customers/page.tsx
- [X] T151 [US6] Create suppliers list page in apps/web/src/app/[locale]/(dashboard)/suppliers/page.tsx
- [X] T152 [US6] Create party form component in apps/web/src/components/forms/party-form.tsx
- [X] T153 [US6] Create party detail page with transaction history in apps/web/src/app/[locale]/(dashboard)/customers/[id]/page.tsx
- [X] T154 [US6] Create payment form component in apps/web/src/components/forms/payment-form.tsx
- [X] T155 [US6] Create payments list page in apps/web/src/app/[locale]/(dashboard)/payments/page.tsx

### Reports - Parties

- [X] T156 [US6] Create customer balances report PDF in apps/web/src/components/reports/customer-balances-report.tsx
- [X] T157 [US6] Create payments report PDF in apps/web/src/components/reports/payments-report.tsx

**Checkpoint**: User Story 6 complete - Parties and payments functional

---

## Phase 9: User Story 7 - Track Business Expenses (Priority: P2)

**Goal**: Record and categorize expenses with search, filter, and reporting

**Independent Test**: Add expenses, categorize, generate expense reports

### Database & Types

- [X] T158 [P] [US7] Create Expense, ExpenseCategory tables migration in packages/database/migrations/008_expenses_schema.sql
- [X] T159 [P] [US7] Define Expense types in packages/shared/src/types/expenses.ts
- [X] T160 [P] [US7] Create Zod validation schemas in packages/shared/src/validation/expenses.ts

### Backend - Expenses API

- [X] T161 [US7] Create ExpenseRepository in apps/api/src/repositories/expense.repository.ts
- [X] T162 [US7] Create ExpenseCategoryRepository in apps/api/src/repositories/expense-category.repository.ts
- [X] T163 [US7] Create ExpenseService in apps/api/src/services/expense.service.ts
- [X] T164 [US7] Implement GET /expenses with filters in apps/api/src/routes/expenses.routes.ts
- [X] T165 [US7] Implement POST /expenses in apps/api/src/routes/expenses.routes.ts
- [X] T166 [US7] Implement PUT /expenses/:id in apps/api/src/routes/expenses.routes.ts
- [X] T167 [P] [US7] Implement expense categories CRUD in apps/api/src/routes/expense-categories.routes.ts

### Frontend - Expenses UI

- [X] T168 [US7] Create useExpenses hook in apps/web/src/hooks/use-expenses.ts
- [X] T169 [US7] Create expenses list page in apps/web/src/app/[locale]/(dashboard)/expenses/page.tsx
- [X] T170 [US7] Create expense form component in apps/web/src/components/forms/expense-form.tsx
- [X] T171 [US7] Create new expense page in apps/web/src/app/[locale]/(dashboard)/expenses/new/page.tsx
- [X] T172 [P] [US7] Create expense categories management UI in apps/web/src/app/[locale]/(dashboard)/expenses/categories/page.tsx

### Reports - Expenses

- [X] T173 [US7] Create expense report PDF template in apps/web/src/components/reports/expense-report.tsx

**Checkpoint**: User Story 7 complete - Expense tracking functional

---

## Phase 10: User Story 8 - System Configuration and User Management (Priority: P2)

**Goal**: Configure subscriptions, users, roles, language, theme, currency

**Independent Test**: Configure settings, create users, verify authorization

### Database & Types

- [X] T174 [P] [US8] Create Currency, ExchangeRate tables migration in packages/database/migrations/009_settings_schema.sql
- [X] T175 [P] [US8] Define settings/currency types in packages/shared/src/types/settings.ts
- [X] T176 [P] [US8] Create Zod validation schemas in packages/shared/src/validation/settings.ts

### Backend - Settings API

- [X] T177 [US8] Create UserRepository in apps/api/src/repositories/user.repository.ts
- [X] T178 [US8] Create RoleRepository in apps/api/src/repositories/role.repository.ts
- [X] T179 [US8] Create CurrencyRepository in apps/api/src/repositories/currency.repository.ts
- [X] T180 [US8] Create SettingsService in apps/api/src/services/settings.service.ts
- [X] T181 [US8] Create UserService with role assignment in apps/api/src/services/user.service.ts
- [X] T182 [US8] Implement GET /users and POST /users in apps/api/src/routes/users.routes.ts
- [X] T183 [US8] Implement roles CRUD in apps/api/src/routes/roles.routes.ts
- [X] T184 [US8] Implement currencies CRUD in apps/api/src/routes/currencies.routes.ts
- [X] T185 [US8] Implement exchange rates CRUD in apps/api/src/routes/exchange-rates.routes.ts
- [X] T186 [US8] Implement tenant settings endpoint in apps/api/src/routes/settings.routes.ts

### Frontend - Settings UI

- [X] T187 [US8] Create settings layout page in apps/web/src/app/[locale]/(dashboard)/settings/page.tsx
- [X] T188 [US8] Create users management page in apps/web/src/app/[locale]/(dashboard)/settings/users/page.tsx
- [X] T189 [US8] Create roles management page in apps/web/src/app/[locale]/(dashboard)/settings/roles/page.tsx
- [X] T190 [US8] Create currency settings page in apps/web/src/app/[locale]/(dashboard)/settings/currencies/page.tsx
- [X] T191 [US8] Create exchange rates page in apps/web/src/app/[locale]/(dashboard)/settings/exchange-rates/page.tsx
- [X] T192 [US8] Create general settings page (language, theme) in apps/web/src/app/[locale]/(dashboard)/settings/general/page.tsx

### Subscription & Limits (Stripe Integration)

- [X] T193 [US8] Create SubscriptionService with Stripe in apps/api/src/services/subscription.service.ts
- [X] T194 [US8] Create Stripe webhook handler in apps/api/src/routes/webhooks.routes.ts
- [X] T195 [US8] Create subscription limits middleware in apps/api/src/middleware/limits.ts
- [X] T196 [US8] Create subscription/billing page in apps/web/src/app/[locale]/(dashboard)/settings/subscription/page.tsx
- [X] T197 [US8] Add upgrade prompts when limits reached in apps/web/src/components/dialogs/upgrade-dialog.tsx

### Audit Logging

- [X] T198 [P] [US8] Create AuditLog table migration in packages/database/migrations/010_audit_schema.sql
- [X] T199 [US8] Create AuditService in apps/api/src/services/audit.service.ts
- [X] T200 [US8] Add audit logging to all mutation operations
- [X] T201 [US8] Create audit logs viewer in apps/web/src/app/[locale]/(dashboard)/settings/audit-logs/page.tsx

**Checkpoint**: User Story 8 complete - System configuration functional

---

## Phase 11: User Story 9 - Enable Accounting Module (Priority: P3)

**Goal**: Optional accounting with chart of accounts, journal entries, financial statements

**Independent Test**: Activate module, run migration wizard, generate financial statements

### Database & Types

- [X] T202 [P] [US9] Create Account, JournalEntry, JournalLine tables migration in packages/database/migrations/011_accounting_schema.sql
- [X] T203 [P] [US9] Define accounting types in packages/shared/src/types/accounting.ts
- [X] T204 [P] [US9] Create Zod validation schemas in packages/shared/src/validation/accounting.ts

### Backend - Accounting API

- [X] T205 [US9] Create AccountRepository in apps/api/src/repositories/account.repository.ts
- [X] T206 [US9] Create JournalEntryRepository in apps/api/src/repositories/journal-entry.repository.ts
- [X] T207 [US9] Create AccountingService with trial balance in apps/api/src/services/accounting.service.ts
- [X] T208 [US9] Create journal entry auto-generation from stock transactions in apps/api/src/services/accounting.service.ts
- [X] T209 [US9] Implement accounts CRUD in apps/api/src/routes/accounts.routes.ts
- [X] T210 [US9] Implement journal entries CRUD in apps/api/src/routes/journal-entries.routes.ts
- [X] T211 [US9] Create activation wizard endpoint POST /accounting/activate in apps/api/src/routes/accounting.routes.ts
- [X] T212 [US9] Create financial statements endpoints (income, balance sheet, cash flow) in apps/api/src/routes/accounting.routes.ts

### Frontend - Accounting UI

- [X] T213 [US9] Create accounting module activation wizard in apps/web/src/components/wizards/accounting-activation.tsx
- [X] T214 [US9] Create chart of accounts page in apps/web/src/app/[locale]/(dashboard)/accounting/accounts/page.tsx
- [X] T215 [US9] Create journal entries page in apps/web/src/app/[locale]/(dashboard)/accounting/journal/page.tsx
- [X] T216 [US9] Create journal entry form with autosave in apps/web/src/components/forms/journal-entry-form.tsx
- [X] T217 [US9] Create general ledger page in apps/web/src/app/[locale]/(dashboard)/accounting/ledger/page.tsx
- [X] T218 [US9] Create trial balance page in apps/web/src/app/[locale]/(dashboard)/accounting/trial-balance/page.tsx
- [X] T219 [US9] Create income statement page in apps/web/src/app/[locale]/(dashboard)/accounting/income-statement/page.tsx
- [X] T220 [US9] Create balance sheet page in apps/web/src/app/[locale]/(dashboard)/accounting/balance-sheet/page.tsx

### Reports - Accounting

- [X] T221 [US9] Create financial statements PDF templates in apps/web/src/components/reports/financial-statements/

**Checkpoint**: User Story 9 complete - Accounting module functional

---

## Phase 12: User Story 10 - Enable HR Module (Priority: P3)

**Goal**: Optional HR with employee management, attendance, payroll

**Independent Test**: Create employees, record attendance, process payroll

### Database & Types

- [X] T222 [P] [US10] Create Employee, Attendance, PayrollRun tables migration in packages/database/migrations/012_hr_schema.sql
- [X] T223 [P] [US10] Define HR types in packages/shared/src/types/hr.ts
- [X] T224 [P] [US10] Create Zod validation schemas in packages/shared/src/validation/hr.ts

### Backend - HR API

- [X] T225 [US10] Create EmployeeRepository in apps/api/src/repositories/employee.repository.ts
- [X] T226 [US10] Create AttendanceRepository in apps/api/src/repositories/attendance.repository.ts
- [X] T227 [US10] Create PayrollRepository in apps/api/src/repositories/payroll.repository.ts
- [X] T228 [US10] Create EmployeeService in apps/api/src/services/employee.service.ts
- [X] T229 [US10] Create AttendanceService in apps/api/src/services/attendance.service.ts
- [X] T230 [US10] Create PayrollService with calculations in apps/api/src/services/payroll.service.ts
- [X] T231 [US10] Implement employees CRUD in apps/api/src/routes/employees.routes.ts
- [X] T232 [US10] Implement attendance CRUD in apps/api/src/routes/attendance.routes.ts
- [X] T233 [US10] Implement payroll endpoints in apps/api/src/routes/payroll.routes.ts
- [X] T234 [US10] Wire payroll to accounting (auto-post expenses) in apps/api/src/services/payroll.service.ts

### Frontend - HR UI

- [X] T235 [US10] Create HR module activation in apps/web/src/components/wizards/hr-activation.tsx
- [X] T236 [US10] Create employees list page in apps/web/src/app/[locale]/(dashboard)/hr/employees/page.tsx
- [X] T237 [US10] Create employee form in apps/web/src/components/forms/employee-form.tsx
- [ ] T238 [US10] Create employee detail page in apps/web/src/app/[locale]/(dashboard)/hr/employees/[id]/page.tsx
- [X] T239 [US10] Create attendance page in apps/web/src/app/[locale]/(dashboard)/hr/attendance/page.tsx
- [ ] T240 [US10] Create leave management page in apps/web/src/app/[locale]/(dashboard)/hr/leave/page.tsx
- [X] T241 [US10] Create payroll page in apps/web/src/app/[locale]/(dashboard)/hr/payroll/page.tsx
- [ ] T242 [US10] Create payroll run form with autosave in apps/web/src/components/forms/payroll-form.tsx

### Reports - HR

- [X] T243 [US10] Create payroll summary PDF template in apps/web/src/components/reports/payroll-report.tsx
- [X] T244 [US10] Create salary slip PDF template in apps/web/src/components/reports/salary-slip.tsx

**Checkpoint**: User Story 10 complete - HR module functional

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### i18n & RTL

- [ ] T245 [P] Complete Arabic translations in apps/web/src/locales/ar/
- [ ] T246 [P] Complete English translations in apps/web/src/locales/en/
- [ ] T247 RTL layout testing and fixes across all components

### Performance & UX

- [ ] T248 [P] Add loading skeletons to all pages
- [ ] T249 [P] Add toast notifications for all mutations
- [ ] T250 Optimize DataTable for 10k+ records with virtualization
- [ ] T251 Add keyboard shortcuts for common actions

### PDF Client-Side Optimization

- [ ] T252 Add pagination and progress indicators for large PDF exports in apps/web/src/lib/pdf-utils.ts
- [ ] T253 Create PDF generation worker for background processing in apps/web/src/workers/pdf-worker.ts

### Security & Error Handling

- [ ] T254 Security audit of all RLS policies
- [ ] T255 Add CSRF protection
- [ ] T256 [P] Create error boundary components in apps/web/src/components/error-boundary.tsx
- [ ] T257 [P] Add Sentry or similar error tracking

### Final Validation

- [ ] T258 Run quickstart.md validation steps
- [ ] T259 Verify all user story acceptance scenarios
- [ ] T260 Performance testing (100 concurrent users, 10k records)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all user stories
- **User Stories (Phase 3-12)**: All depend on Phase 2 completion
  - P1 stories (US1-3) should complete first for MVP
  - P2 stories (US4-8) can proceed after foundational
  - P3 stories (US9-10) are optional modules
- **Polish (Phase 13)**: Depends on desired user stories being complete

### User Story Dependencies

| Story | Priority | Dependencies | Notes |
|-------|----------|--------------|-------|
| US1 Items | P1 | Foundational | No cross-story dependencies |
| US2 Sales | P1 | Foundational | Uses Party select (can stub initially) |
| US3 Purchases | P1 | US2 (shared InvoiceService) | Extends sales infrastructure |
| US4 Warehouses | P2 | Foundational | Inventory linked to US1 Items |
| US5 POS | P2 | US4 Warehouses | Requires warehouse assignment |
| US6 Parties | P2 | Foundational | Used by US2/US3 (can implement in parallel) |
| US7 Expenses | P2 | Foundational | Independent |
| US8 Settings | P2 | Foundational | Independent |
| US9 Accounting | P3 | US2, US3, US6, US7 | Integrates with all transactions |
| US10 HR | P3 | US9 (optional) | Can integrate with accounting |

### Parallel Opportunities

**Within Setup (Phase 1)**:
```
T002, T003, T004 (all packages) - parallel
T007, T008, T009 (configs) - parallel
```

**Within Foundational (Phase 2)**:
```
T017, T018, T019, T020 (shared types) - parallel
T024, T025, T026 (middleware) - parallel
T030, T031, T033 (frontend stores) - parallel
T040, T041 (layout components) - parallel
```

**User Story parallelism after Foundational**:
- US1 Items + US6 Parties + US7 Expenses + US8 Settings can start simultaneously
- US2 Sales can start (will use Party select stub until US6 done)
- US4 Warehouses can start after inventory tables created

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 Items
4. Complete Phase 4: US2 Sales (with basic party stub)
5. Complete Phase 5: US3 Purchases
6. **STOP and VALIDATE**: Core buy-sell cycle functional
7. Deploy/demo MVP

### Suggested MVP Scope

- **Minimum**: US1 (Items) + US2 (Sales) + US6 (Parties/Payments)
- **Recommended**: Add US3 (Purchases) + US4 (Warehouses) for full inventory cycle

### Incremental Delivery After MVP

1. Add US4 Warehouses → multi-location inventory
2. Add US5 POS → retail operations
3. Add US7 Expenses → cost tracking
4. Add US8 Settings → full admin capabilities
5. Add US9 Accounting → financial compliance (optional)
6. Add US10 HR → workforce management (optional)

---

## Summary

| Phase | Task Range | Count | Description |
|-------|------------|-------|-------------|
| 1 | T001-T012 | 12 | Setup |
| 2 | T013-T042 | 30 | Foundational |
| 3 | T043-T067 | 25 | US1 Items (P1) |
| 4 | T068-T093 | 26 | US2 Sales (P1) |
| 5 | T094-T102 | 9 | US3 Purchases (P1) |
| 6 | T103-T125 | 23 | US4 Warehouses (P2) |
| 7 | T126-T136 | 11 | US5 POS (P2) |
| 8 | T137-T157 | 21 | US6 Parties (P2) |
| 9 | T158-T173 | 16 | US7 Expenses (P2) |
| 10 | T174-T201 | 28 | US8 Settings (P2) |
| 11 | T202-T221 | 20 | US9 Accounting (P3) |
| 12 | T222-T244 | 23 | US10 HR (P3) |
| 13 | T245-T260 | 16 | Polish |
| **Total** | | **260** | |

### Tasks per User Story

| User Story | Priority | Task Count |
|------------|----------|------------|
| US1 Items | P1 | 25 |
| US2 Sales | P1 | 26 |
| US3 Purchases | P1 | 9 |
| US4 Warehouses | P2 | 23 |
| US5 POS | P2 | 11 |
| US6 Parties | P2 | 21 |
| US7 Expenses | P2 | 16 |
| US8 Settings | P2 | 28 |
| US9 Accounting | P3 | 20 |
| US10 HR | P3 | 23 |

### Parallel Opportunities Identified

- **Setup phase**: 7 parallel task groups
- **Foundational phase**: 8 parallel task groups
- **Per user story**: 2-4 parallel task groups each
- **Cross-story**: US1, US6, US7, US8 can all start in parallel after foundational

---

## Notes

- All tasks follow format: `- [ ] T### [P?] [US?] Description with file path`
- [P] indicates parallelizable (different files, no dependencies)
- [US#] indicates which user story the task belongs to
- Each user story is independently testable at its checkpoint
- MVP = Phase 1 + Phase 2 + Phase 3 (Items only) or add US2+US3 for sales cycle
- Tests not included per specification - add TDD tasks if requested
