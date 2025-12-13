# Feature Specification: Modular ERP SaaS Platform

**Feature Branch**: `001-modular-erp-saas`
**Created**: 2025-12-12
**Status**: Draft
**Input**: User description: "Modular ERP SaaS platform with Stock Management as core MVP, optional Accounting and HR add-ons. Multi-language (AR/EN), dark/light themes, subscription plans (Freemium 1 month, Premium), advanced behavior logs. Excel-like UX with fixed headers, adjustable columns/rows. Local autosave for drafts. PDF export for all reports."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Inventory Items (Priority: P1)

As a business owner or stock manager, I need to define and manage my inventory items including names, aliases, brands, barcodes/QR codes, tax settings, units, packaging options, images, and multiple price tiers so that I can maintain accurate product information across my business operations.

**Why this priority**: Items are the foundational data for all stock management operations. Without item definitions, no sales, purchases, or inventory tracking can occur. This is the core building block of the MVP.

**Independent Test**: Can be fully tested by creating, editing, searching, and bulk-updating items. Delivers immediate value by establishing the product catalog.

**Acceptance Scenarios**:

1. **Given** I am on the Items Management page, **When** I click "Add New Item" and fill in required fields (name, unit, base price), **Then** the item is saved and appears in the items list
2. **Given** I have existing items, **When** I use the search/filter functionality, **Then** I can find items by name, alias, brand, barcode, or category
3. **Given** I need to update multiple prices, **When** I select multiple items and apply bulk price adjustment (percentage or fixed amount), **Then** all selected items' prices are updated accordingly
4. **Given** I have item data, **When** I generate an items report and export to PDF, **Then** I receive a downloadable PDF with formatted item information

---

### User Story 2 - Create and Manage Sales Invoices (Priority: P1)

As a sales person or business owner, I need to create sales invoices with real-time stock preview, customer selection, item search, and flexible pricing so that I can process sales transactions efficiently and maintain accurate records.

**Why this priority**: Sales invoices are the primary revenue-generating transaction. This is essential for any business operation and directly impacts cash flow tracking.

**Independent Test**: Can be fully tested by creating initial, final, and returned invoices with customer linking. Delivers core sales functionality.

**Acceptance Scenarios**:

1. **Given** I am creating a new invoice, **When** I search and select items to add, **Then** I see real-time stock availability before confirming quantities
2. **Given** I am adding items to an invoice, **When** I use the item list interface, **Then** I can sort columns, hide/show columns, reorder items via drag-and-drop, and search within the list
3. **Given** I select a customer via searchable dropdown, **When** customer is selected, **Then** their balance and relevant details are displayed
4. **Given** I am working on an invoice and close the browser unexpectedly, **When** I return to the invoice page, **Then** my draft data is restored from local autosave
5. **Given** I have a finalized invoice, **When** I need to process a return, **Then** I can create a returned invoice linked to the original

---

### User Story 3 - Process Purchase Orders (Priority: P1)

As a purchasing manager or business owner, I need to create purchase orders and manage supplier transactions with real-time stock preview so that I can replenish inventory and track costs accurately.

**Why this priority**: Purchases are essential for maintaining inventory levels and tracking business costs. This completes the buy-sell cycle fundamental to stock management.

**Independent Test**: Can be fully tested by creating purchase orders, final purchases, and returns. Delivers procurement functionality independently.

**Acceptance Scenarios**:

1. **Given** I am creating a purchase order, **When** I add items, **Then** I see current stock levels to inform purchase quantities
2. **Given** I select a supplier via searchable dropdown, **When** supplier is selected, **Then** their balance and payment history are visible
3. **Given** I have a purchase order, **When** goods are received, **Then** I can convert it to a final purchase and stock levels update automatically
4. **Given** I receive defective goods, **When** I create a return, **Then** stock and supplier balance adjust accordingly

---

### User Story 4 - Manage Warehouses and Stock Transfers (Priority: P2)

As a warehouse manager, I need to create warehouses, transfer items between locations, manage settlements, and receive low stock alerts so that I can optimize inventory distribution across locations.

**Why this priority**: Multi-warehouse support extends the core inventory capability. Important for businesses with multiple locations but not required for basic MVP functionality.

**Independent Test**: Can be fully tested by creating warehouses, transferring stock, and configuring alerts. Delivers multi-location inventory management.

**Acceptance Scenarios**:

1. **Given** I manage multiple locations, **When** I create a warehouse with name and details, **Then** it becomes available for stock assignment
2. **Given** I have stock in Warehouse A, **When** I initiate a transfer to Warehouse B, **Then** stock levels adjust in both locations upon completion
3. **Given** I set a low stock threshold for an item, **When** stock falls below threshold, **Then** I receive an alert notification
4. **Given** I need to view warehouse value, **When** I open warehouse details, **Then** I see total stock value based on item costs

---

### User Story 5 - Manage Point of Sale Locations (Priority: P2)

As a retail manager, I need to set up POS locations with receipt printing, discounts, promotions, and loyalty programs so that I can manage retail operations efficiently.

**Why this priority**: POS extends sales capabilities to retail scenarios. Valuable for retail businesses but not required for B2B or wholesale operations.

**Independent Test**: Can be fully tested by configuring POS locations and processing POS transactions with discounts and loyalty. Delivers retail sales functionality.

**Acceptance Scenarios**:

1. **Given** I have a retail location, **When** I create a POS location, **Then** it is linked to a warehouse for stock tracking
2. **Given** I am processing a sale at POS, **When** I apply a discount or promotion, **Then** the transaction reflects the adjusted pricing
3. **Given** a customer is enrolled in loyalty, **When** they make a purchase, **Then** loyalty points accumulate based on configured rules
4. **Given** a sale is complete, **When** I finalize, **Then** a receipt is generated for printing

---

### User Story 6 - Manage Customers, Suppliers, and Payments (Priority: P2)

As a business owner, I need to manage customer and supplier records with auto-updating balances and flexible payment recording so that I can track who owes me and who I owe.

**Why this priority**: Party management with balances is essential for credit-based business operations and forms the foundation for cash flow visibility.

**Independent Test**: Can be fully tested by creating parties, recording payments, and viewing balance reports. Delivers accounts receivable/payable tracking.

**Acceptance Scenarios**:

1. **Given** I create a customer record, **When** I create sales invoices for this customer, **Then** their balance updates automatically
2. **Given** a customer owes money, **When** I record a payment received, **Then** I can link it to specific invoices or apply to account generally
3. **Given** I have payments recorded, **When** I generate a payments report, **Then** I see all received and made payments with export to PDF
4. **Given** I want to see who owes me, **When** I view customer balances report, **Then** I see outstanding amounts per customer

---

### User Story 7 - Track Business Expenses (Priority: P2)

As a business owner, I need to record and categorize business expenses with search, filter, and reporting capabilities so that I can track operational costs.

**Why this priority**: Expense tracking provides cost visibility even without full accounting. Important for profitability awareness but not blocking for core stock operations.

**Independent Test**: Can be fully tested by adding expenses, categorizing them, and generating expense reports. Delivers cost tracking functionality.

**Acceptance Scenarios**:

1. **Given** I incur a business expense, **When** I add it with category, amount, and date, **Then** it is recorded in the system
2. **Given** I have multiple expenses, **When** I search and filter by category, date range, or amount, **Then** I see matching expenses
3. **Given** I need expense reporting, **When** I generate an expense report for a period, **Then** I receive a PDF with categorized expense summary

---

### User Story 8 - System Configuration and User Management (Priority: P2)

As an administrator, I need to configure subscription plans, manage user roles and permissions, set language preferences (AR/EN), choose themes (dark/light), and manage currency settings so that the system meets organizational needs.

**Why this priority**: System configuration enables multi-tenancy and personalization. Required for SaaS operation but individual features don't block core functionality.

**Independent Test**: Can be fully tested by configuring settings, creating users, and verifying authorization controls. Delivers administrative functionality.

**Acceptance Scenarios**:

1. **Given** a new tenant signs up, **When** they select Freemium plan, **Then** they get 1 month free access with feature limitations
2. **Given** a user has role "Sales", **When** they try to access Warehouse settings, **Then** access is denied based on authorization rules
3. **Given** a user prefers Arabic, **When** they set language to AR, **Then** the entire interface displays in Arabic (RTL layout)
4. **Given** a user prefers dark mode, **When** they toggle theme, **Then** the interface switches to dark theme
5. **Given** the business operates with multiple currencies, **When** I set daily exchange rates (formal and black market vs USD), **Then** transactions can use appropriate rates

---

### User Story 9 - Enable Accounting Module (Priority: P3)

As a business owner requiring formal financial compliance, I need to activate the Accounting module that integrates with Stock data to provide chart of accounts, journal entries, ledgers, trial balance, and financial statements so that I meet IFRS/GAAP requirements.

**Why this priority**: Accounting is an optional upsell module. Stock MVP is fully functional without it. Activating accounting adds financial compliance capabilities.

**Independent Test**: Can be fully tested by activating module, running migration wizard, and generating financial statements. Delivers formal accounting compliance.

**Acceptance Scenarios**:

1. **Given** I have Stock module active, **When** I activate Accounting, **Then** an activation wizard imports historical data and generates opening balances
2. **Given** Accounting is active, **When** I create a sale in Stock, **Then** a journal entry is auto-generated
3. **Given** I need formal financials, **When** I generate Income Statement, Balance Sheet, or Cash Flow Statement, **Then** I receive IFRS/GAAP compliant reports in PDF
4. **Given** I have bank accounts, **When** I record deposits, withdrawals, and transfers, **Then** bank reconciliation is available

---

### User Story 10 - Enable HR Module (Priority: P3)

As a business owner with employees, I need to activate the HR module to manage employee records, attendance, leave, payroll, and performance records so that I can handle workforce management.

**Why this priority**: HR is an optional upsell module. Core business operations don't require HR. Activating HR adds workforce management.

**Independent Test**: Can be fully tested by creating employees, recording attendance, processing payroll. Delivers HR management functionality.

**Acceptance Scenarios**:

1. **Given** I activate HR module, **When** I add an employee with profile details, **Then** their record is created with department, role, and salary information
2. **Given** employees are defined, **When** I record attendance or process leave requests, **Then** leave balances and attendance records update
3. **Given** a payroll period ends, **When** I run payroll with allowances/deductions linked to attendance, **Then** payroll calculations are generated with multi-currency support
4. **Given** Accounting is also active, **When** I run payroll, **Then** payroll expenses are auto-posted to Accounting

---

### Edge Cases

- What happens when user tries to sell more items than available in stock? System should warn but allow override with permission for backorders.
- What happens when a draft is being edited on multiple devices? Last save wins with conflict notification to user.
- How does system handle currency conversion when rate changes mid-transaction? Rate is locked at transaction creation time.
- What happens when Accounting module is deactivated after activation? Historical journal entries are preserved but new auto-generation stops.
- What happens when item with open transactions is deleted? Soft delete only; item marked inactive but historical data preserved.
- How does system handle RTL/LTR mixed content (e.g., English product names in Arabic interface)? Text direction follows content language with proper bidirectional support.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Stock Management Module (Core MVP)

**Items Management**
- **FR-001**: System MUST allow users to define items with: name, aliases, brand, barcode/QR code, tax settings, unit of measure, packaging options, multiple images, and multiple price tiers
- **FR-002**: System MUST provide search, filter, and sort capabilities for items by any attribute
- **FR-003**: System MUST support bulk price adjustments (percentage or fixed amount) for selected items
- **FR-004**: System MUST generate item reports exportable to PDF

**Warehouse Management**
- **FR-005**: System MUST allow creation, update, and deletion of warehouses
- **FR-006**: System MUST display preview of total stock value per warehouse
- **FR-007**: System MUST support item transfers between warehouses with audit trail
- **FR-008**: System MUST support warehouse settlements and stock reconciliation
- **FR-009**: System MUST provide configurable low stock alerts per item/warehouse

**POS Management**
- **FR-010**: System MUST allow management of POS locations linked to warehouses
- **FR-011**: System MUST support receipt generation and printing
- **FR-012**: System MUST support discounts, promotions, and loyalty programs

**Sales Management**
- **FR-013**: System MUST support initial invoices, final invoices, and returned invoices
- **FR-014**: System MUST implement local autosave for draft invoices
- **FR-015**: System MUST provide Excel-like item list with: sorting, hiding/showing columns, bulk price changes, search, drag-and-drop reordering
- **FR-016**: System MUST provide searchable customer dropdown with balance preview
- **FR-017**: System MUST display real-time stock availability when selecting items
- **FR-018**: System MUST provide searchable and filterable sales records
- **FR-019**: System MUST generate sales reports exportable to PDF

**Purchase Management**
- **FR-020**: System MUST support purchase orders, final purchases, and returned purchases
- **FR-021**: System MUST implement local autosave for draft purchases
- **FR-022**: System MUST provide Excel-like item list with same capabilities as sales
- **FR-023**: System MUST provide searchable supplier dropdown with balance preview
- **FR-024**: System MUST display real-time stock levels when selecting items
- **FR-025**: System MUST generate purchase reports exportable to PDF

**Customers & Suppliers**
- **FR-026**: System MUST manage customer and supplier records linked to transactions
- **FR-027**: System MUST auto-update balances based on invoices and payments
- **FR-028**: System MUST allow payments to be recorded anytime (linked to invoices or general account)
- **FR-029**: System MUST provide preview and edit functionality for payments
- **FR-030**: System MUST generate balance and payment reports exportable to PDF
- **FR-031**: System MUST NOT provide formal financial statements (reserved for Accounting module)

**Expenses**
- **FR-032**: System MUST allow adding and editing expenses by category
- **FR-033**: System MUST provide search and filter for expenses
- **FR-034**: System MUST generate expense reports exportable to PDF

#### System-Wide Features

**Subscription & Tenancy**
- **FR-035**: System MUST support Freemium plan (1 month free with feature limitations) and Premium plan
- **FR-036**: System MUST isolate tenant data completely in multi-tenant architecture

**Localization**
- **FR-037**: System MUST support Arabic (AR) and English (EN) languages with full RTL/LTR support
- **FR-038**: System MUST allow users to switch language at any time

**Themes**
- **FR-039**: System MUST support dark and light themes
- **FR-040**: System MUST persist theme preference per user

**Logging**
- **FR-041**: System MUST maintain advanced logs of user behavior and actions
- **FR-042**: System MUST log all security-relevant events

**Authorization**
- **FR-043**: System MUST provide role-based authorization management
- **FR-044**: System MUST enforce permissions at feature and data levels

**Currency**
- **FR-045**: System MUST support multiple currencies with manual daily rate entry
- **FR-046**: System MUST support both formal and black market exchange rates vs USD

**UX Requirements**
- **FR-047**: System MUST implement fixed table headers that remain visible during scrolling
- **FR-048**: System MUST allow adjustable column widths and row heights (Excel-like)
- **FR-049**: System MUST implement local autosave for all draft data until finalized

#### Accounting Module (Optional Add-on)

- **FR-050**: System MUST provide IFRS/GAAP-compliant customizable chart of accounts
- **FR-051**: System MUST support manual journal entries with local autosave
- **FR-052**: System MUST auto-generate journal entries from Stock transactions (sales, purchases, payments, expenses, settlements)
- **FR-053**: System MUST provide General Ledger with consolidated view and drill-down
- **FR-054**: System MUST provide real-time Trial Balance with multi-currency support
- **FR-055**: System MUST generate Income Statement, Balance Sheet, and Cash Flow Statement
- **FR-056**: System MUST provide Accounts Receivable management linked to Sales with aging reports
- **FR-057**: System MUST provide Accounts Payable management linked to Purchases with aging reports
- **FR-058**: System MUST support Bank & Cash Management (deposits, withdrawals, transfers, reconciliation)
- **FR-059**: System MUST support configurable tax rates with auto-calculation and compliance reports
- **FR-060**: System MUST replay Stock event logs into Accounting when module is activated
- **FR-061**: System MUST provide activation wizard that imports history, generates opening balances, and creates trial balance

#### HR Module (Optional Add-on)

- **FR-062**: System MUST manage employee profiles with personal info, department, role, salary, and documents
- **FR-063**: System MUST record attendance and manage leave requests with approval workflow
- **FR-064**: System MUST track leave balances per employee
- **FR-065**: System MUST support payroll with salary structures, allowances, and deductions
- **FR-066**: System MUST link payroll to attendance data
- **FR-067**: System MUST support multi-currency payroll
- **FR-068**: System MUST implement local autosave for payroll drafts
- **FR-069**: System MUST generate payroll summary and salary slip reports
- **FR-070**: System MUST support HR-specific roles (admin, manager, employee self-service)
- **FR-071**: System MUST support performance and experience records (training, achievements, disciplinary)
- **FR-072**: System MUST auto-post payroll expenses to Accounting when both modules are active
- **FR-073**: System MUST link employees to POS/warehouse operations when Stock is active

---

### Non-Functional Requirements

**Availability & Reliability**
- **NFR-001**: System MUST maintain 99.5% uptime (approximately 43 hours maximum downtime per year)
- **NFR-002**: Planned maintenance windows SHOULD be scheduled during off-peak hours with advance notice to tenants

---

### Key Entities

- **Tenant**: Organization subscribing to the platform; contains all other entities; has subscription plan and settings
- **User**: Person with access to the system; belongs to a tenant; has roles and permissions; has language and theme preferences
- **Item**: Product or service managed in inventory; has attributes, prices, images, tax settings; belongs to categories
- **Warehouse**: Physical or logical storage location; contains stock quantities; has value calculations
- **POS Location**: Point of sale location; linked to warehouse; has receipt and promotion settings
- **Invoice**: Sales or purchase transaction document; has line items, customer/supplier, status (draft/final/returned); auto-saves locally
- **Customer**: Party who buys from the business; has balance, payment history, contact information
- **Supplier**: Party who sells to the business; has balance, payment history, contact information
- **Payment**: Money received from customer or paid to supplier; can be linked to invoices or general account
- **Expense**: Business expense record; has category, amount, date, description
- **Account (Accounting)**: Chart of accounts entry; IFRS/GAAP compliant; has type, balance, parent relationships
- **Journal Entry (Accounting)**: Double-entry transaction record; can be manual or auto-generated; has debits and credits
- **Employee (HR)**: Person employed by the tenant; has profile, salary, department, attendance records
- **Payroll Run (HR)**: Periodic payroll processing batch; has calculations, allowances, deductions, multi-currency support
- **Currency**: Supported currency with exchange rate settings; has formal and black market rates
- **Audit Log**: Record of user action; has timestamp, user, action type, entity affected, before/after values

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Usability & Efficiency**
- **SC-001**: Users can create a complete sales invoice with 10 line items in under 3 minutes
- **SC-002**: Users can find any item using search in under 5 seconds with instant results display
- **SC-003**: 95% of users successfully complete their first invoice without external help
- **SC-004**: Draft data recovery succeeds 100% of the time after unexpected browser closure

**Performance**
- **SC-005**: System supports 100 concurrent users per tenant without noticeable slowdown
- **SC-006**: All data tables load within 2 seconds even with 10,000 records
- **SC-007**: PDF report generation completes within 10 seconds for reports with up to 1,000 records

**Business Value**
- **SC-008**: Freemium to Premium conversion rate exceeds 15% after trial period
- **SC-009**: Users activate optional modules (Accounting or HR) within 6 months of subscription at 25% rate
- **SC-010**: Time to complete end-of-day reconciliation reduced by 50% compared to manual methods

**Data Integrity**
- **SC-011**: Customer and supplier balances match sum of all related transactions with 100% accuracy
- **SC-012**: Inventory quantities match sum of all stock movements with 100% accuracy
- **SC-013**: When Accounting is activated, trial balance balances (debits equal credits) at all times

**Localization**
- **SC-014**: Language switch completes instantly with full interface translation
- **SC-015**: RTL layout displays correctly for all components in Arabic mode

**Module Integration**
- **SC-016**: Accounting activation wizard completes historical data import within 5 minutes for 12 months of Stock data
- **SC-017**: Auto-generated journal entries from Stock transactions require no manual corrections in 99% of cases

---

## Clarifications

### Session 2025-12-12

- Q: What primary technology stack should be used for the platform? → A: Next.js with shadcn/ui frontend, Node.js backend, Supabase database
- Q: What multi-tenancy isolation strategy should be used for tenant data separation? → A: Shared database with row-level isolation via tenant_id + Supabase RLS policies
- Q: What authentication approach should be used? → A: Supabase Auth (built-in email/password + social providers, integrates with RLS)
- Q: What specific limits should apply to the Freemium plan? → A: Strict: 50 items, 1 user, 25 transactions/month, no PDF exports
- Q: What uptime/availability target should the platform aim for? → A: 99.5% uptime (~43 hours downtime/year) - standard SaaS tier

---

## Technical Stack

- **Frontend**: Next.js with shadcn/ui component library
- **Backend**: Node.js (API layer)
- **Database**: Supabase (PostgreSQL-based with built-in auth, real-time subscriptions, and storage)
- **Styling**: Tailwind CSS (via shadcn/ui)
- **Multi-tenancy**: Shared database with row-level isolation; all tables include `tenant_id` column enforced via Supabase RLS policies
- **Authentication**: Supabase Auth (email/password + social providers); JWT tokens integrate directly with RLS policies

---

## Assumptions

1. **Target Market**: Small to medium businesses in regions where both formal and black market currency rates are relevant (e.g., Middle East, Africa)
2. **Deployment Model**: Cloud-hosted SaaS with browser-based access; no desktop or mobile native apps in initial scope
3. **Payment Processing**: The platform does not process actual payments; it records payment information only
4. **Barcode/QR**: System stores and displays barcode/QR data; hardware integration for scanning is browser-based
5. **Receipt Printing**: Receipt printing uses browser print functionality or thermal printer integration via standard protocols
6. **Document Storage**: Item images and employee documents stored in cloud storage with size limits per tenant
7. **Freemium Limitations**: Freemium plan enforces: maximum 50 items, 1 user, 25 transactions/month, no PDF exports; Premium plan removes all limits
8. **Compliance**: IFRS/GAAP compliance means following standard chart of accounts structure and financial statement formats; not full regulatory certification
9. **Data Retention**: All transaction data retained for minimum 7 years per standard business practice
10. **Authentication**: Standard email/password authentication with optional organization SSO integration

---

## Dependencies

- PDF generation capability for report exports
- Cloud storage for images and documents
- Email service for notifications and password reset
- Exchange rate data source (manual entry, not automatic feed)

---

## Out of Scope

- Mobile native applications (iOS/Android)
- E-commerce integration
- Automated bank feed imports
- Inventory manufacturing/BOM features
- CRM advanced features (beyond basic customer records)
- Automated tax filing/submission to authorities
- Hardware device management (barcode scanners, receipt printers managed externally)
