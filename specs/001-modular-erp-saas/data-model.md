# Data Model: Modular ERP SaaS Platform

**Branch**: `001-modular-erp-saas` | **Date**: 2025-12-13

---

## Entity Relationship Overview

```
                                    ┌─────────────┐
                                    │   Tenant    │
                                    └──────┬──────┘
                                           │
           ┌───────────────┬───────────────┼───────────────┬───────────────┐
           │               │               │               │               │
     ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
     │   User    │   │   Item    │   │ Warehouse │   │   Party   │   │  Currency │
     └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   └───────────┘
           │               │               │               │
     ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐         │
     │   Role    │   │ Inventory │◄──┤ Transfer  │         │
     └───────────┘   └───────────┘   └───────────┘         │
                                                           │
                           ┌───────────────────────────────┼───────────────┐
                           │                               │               │
                     ┌─────▼─────┐                   ┌─────▼─────┐   ┌─────▼─────┐
                     │  Invoice  │                   │  Payment  │   │  Expense  │
                     └─────┬─────┘                   └───────────┘   └───────────┘
                           │
                     ┌─────▼─────┐
                     │InvoiceItem│
                     └───────────┘
```

---

## Core Entities

### Tenant

The root entity for multi-tenancy. All other entities belong to a tenant.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| name | TEXT | NOT NULL | Organization name |
| subscription_plan | ENUM | 'freemium', 'premium' | Current plan |
| subscription_status | ENUM | 'active', 'trialing', 'canceled', 'past_due' | Stripe sync |
| stripe_customer_id | TEXT | NULLABLE | Stripe customer reference |
| stripe_subscription_id | TEXT | NULLABLE | Stripe subscription reference |
| settings | JSONB | DEFAULT '{}' | Language, theme, currency defaults |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Validation Rules**:
- Name: 1-255 characters
- Settings must contain valid JSON with optional keys: `default_language`, `default_theme`, `default_currency`

---

### User

System users with authentication and authorization.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, FK auth.users | Links to Supabase Auth |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant membership |
| email | TEXT | NOT NULL, UNIQUE per tenant | User email |
| full_name | TEXT | NULLABLE | Display name |
| role_id | UUID | FK roles | Authorization role |
| preferences | JSONB | DEFAULT '{}' | Language, theme overrides |
| is_active | BOOLEAN | DEFAULT true | Soft disable |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Validation Rules**:
- Email must be valid format
- One user per email per tenant (can have same email in different tenants)

---

### Role

Authorization roles with permissions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| name | TEXT | NOT NULL | Role name (Admin, Sales, etc.) |
| permissions | JSONB | NOT NULL | Array of permission strings |
| is_system | BOOLEAN | DEFAULT false | System roles cannot be deleted |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Permission Examples**:
```json
["items:read", "items:write", "invoices:read", "invoices:write", "reports:read", "reports:export"]
```

**Default System Roles**:
- `admin`: All permissions
- `sales`: Items read, invoices CRUD, customers CRUD
- `warehouse`: Items CRUD, warehouses CRUD, transfers CRUD
- `viewer`: Read-only access

---

### Item

Products and services managed in inventory.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| name | TEXT | NOT NULL | Item name |
| name_alias | TEXT | NULLABLE | Alternative name |
| sku | TEXT | NULLABLE | Stock keeping unit |
| barcode | TEXT | NULLABLE | Barcode/QR code |
| brand | TEXT | NULLABLE | Brand name |
| category_id | UUID | FK categories | Item category |
| unit_of_measure | TEXT | NOT NULL | Base unit (piece, kg, meter) |
| tax_rate | DECIMAL(5,2) | DEFAULT 0 | Default tax percentage |
| is_active | BOOLEAN | DEFAULT true | Soft delete |
| images | TEXT[] | DEFAULT '{}' | Array of image URLs |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Validation Rules**:
- Name: 1-255 characters
- SKU: Unique per tenant if provided
- Barcode: Unique per tenant if provided
- Tax rate: 0-100

---

### ItemPrice

Multiple price tiers per item.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| item_id | UUID | FK items, ON DELETE CASCADE | Parent item |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| price_tier | TEXT | NOT NULL | Tier name (retail, wholesale, vip) |
| price | DECIMAL(15,2) | NOT NULL, >= 0 | Price amount |
| currency | TEXT | DEFAULT 'USD' | Currency code |
| effective_from | DATE | NULLABLE | Start date (NULL = always) |
| effective_to | DATE | NULLABLE | End date (NULL = no end) |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Validation Rules**:
- Price >= 0
- effective_to must be >= effective_from if both provided
- Unique constraint on (item_id, price_tier, currency, effective_from)

---

### ItemPackaging

Packaging options for items (box, carton, etc.).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| item_id | UUID | FK items, ON DELETE CASCADE | Parent item |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| name | TEXT | NOT NULL | Package name (box, carton) |
| quantity | INTEGER | NOT NULL, > 0 | Units per package |
| barcode | TEXT | NULLABLE | Package-specific barcode |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

---

### Category

Hierarchical item categories.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| name | TEXT | NOT NULL | Category name |
| parent_id | UUID | FK categories | Parent category (NULL = root) |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Validation Rules**:
- No circular parent references
- Max depth: 5 levels

---

### Warehouse

Physical or logical storage locations.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| name | TEXT | NOT NULL | Warehouse name |
| address | TEXT | NULLABLE | Physical address |
| is_active | BOOLEAN | DEFAULT true | Soft delete |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

---

### Inventory

Stock levels per item per warehouse.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| item_id | UUID | FK items, NOT NULL | Item reference |
| warehouse_id | UUID | FK warehouses, NOT NULL | Warehouse reference |
| quantity | DECIMAL(15,3) | NOT NULL, DEFAULT 0 | Available quantity |
| reserved_quantity | DECIMAL(15,3) | DEFAULT 0 | Reserved for pending orders |
| low_stock_threshold | DECIMAL(15,3) | NULLABLE | Alert threshold |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Constraints**:
- UNIQUE(item_id, warehouse_id)
- quantity >= 0 (enforced, backorders handled separately)

**State Transitions**:
- Sale finalized: quantity -= sold_qty
- Purchase finalized: quantity += received_qty
- Transfer out: quantity -= transfer_qty
- Transfer in: quantity += transfer_qty

---

### Party (Customers & Suppliers)

Business partners - customers and suppliers in single table.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| type | ENUM | 'customer', 'supplier' | Party type |
| name | TEXT | NOT NULL | Party name |
| email | TEXT | NULLABLE | Contact email |
| phone | TEXT | NULLABLE | Contact phone |
| address | TEXT | NULLABLE | Address |
| tax_number | TEXT | NULLABLE | VAT/Tax ID |
| balance | DECIMAL(15,2) | DEFAULT 0 | Current balance (denormalized) |
| is_active | BOOLEAN | DEFAULT true | Soft delete |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Balance Rules**:
- Customer: Positive = they owe us, Negative = credit/overpayment
- Supplier: Positive = we owe them, Negative = credit/overpayment
- Updated automatically on invoice finalization and payment recording

---

### Invoice

Sales and purchase transactions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| invoice_number | TEXT | NOT NULL | Auto-generated number |
| type | ENUM | 'sale', 'purchase' | Transaction type |
| status | ENUM | 'draft', 'final', 'returned', 'canceled' | Invoice status |
| party_id | UUID | FK parties | Customer/Supplier |
| warehouse_id | UUID | FK warehouses, NOT NULL | Stock location |
| subtotal | DECIMAL(15,2) | NOT NULL | Sum of line items |
| tax_amount | DECIMAL(15,2) | DEFAULT 0 | Total tax |
| discount_amount | DECIMAL(15,2) | DEFAULT 0 | Invoice-level discount |
| total | DECIMAL(15,2) | NOT NULL | Final amount |
| currency | TEXT | DEFAULT 'USD' | Transaction currency |
| exchange_rate | DECIMAL(15,6) | DEFAULT 1 | Rate to base currency |
| notes | TEXT | NULLABLE | Comments |
| created_by | UUID | FK users | Creator |
| returned_from_id | UUID | FK invoices | Original invoice for returns |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update timestamp |
| finalized_at | TIMESTAMPTZ | NULLABLE | When finalized |

**State Transitions**:
- draft → final: Stock adjustments applied, party balance updated
- final → returned: Creates new return invoice linked via returned_from_id
- draft → canceled: No stock/balance changes

**Invoice Number Format**: `{TYPE}-{YEAR}{MONTH}-{SEQUENCE}`
- Sale: `SAL-202512-0001`
- Purchase: `PUR-202512-0001`

---

### InvoiceItem

Line items on invoices.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| invoice_id | UUID | FK invoices, ON DELETE CASCADE | Parent invoice |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| item_id | UUID | FK items, NOT NULL | Item reference |
| description | TEXT | NULLABLE | Line description override |
| quantity | DECIMAL(15,3) | NOT NULL, > 0 | Quantity |
| unit_price | DECIMAL(15,2) | NOT NULL, >= 0 | Price per unit |
| discount_percent | DECIMAL(5,2) | DEFAULT 0 | Line discount % |
| tax_rate | DECIMAL(5,2) | DEFAULT 0 | Tax rate |
| line_total | DECIMAL(15,2) | NOT NULL | Calculated total |
| sort_order | INTEGER | DEFAULT 0 | Display order |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Calculation**:
```
line_total = quantity * unit_price * (1 - discount_percent/100) * (1 + tax_rate/100)
```

---

### Payment

Money received from customers or paid to suppliers.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| party_id | UUID | FK parties, NOT NULL | Customer/Supplier |
| type | ENUM | 'received', 'made' | Payment direction |
| amount | DECIMAL(15,2) | NOT NULL, > 0 | Payment amount |
| currency | TEXT | DEFAULT 'USD' | Payment currency |
| exchange_rate | DECIMAL(15,6) | DEFAULT 1 | Rate to base currency |
| payment_method | TEXT | NULLABLE | Cash, Bank, Check, etc. |
| reference | TEXT | NULLABLE | Check number, transfer ref |
| invoice_id | UUID | FK invoices | Optional linked invoice |
| notes | TEXT | NULLABLE | Comments |
| created_by | UUID | FK users | Creator |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Balance Effect**:
- Payment received from customer: balance -= amount (reduces what they owe)
- Payment made to supplier: balance -= amount (reduces what we owe)

---

### Expense

Business expenses tracking.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| category_id | UUID | FK expense_categories | Expense category |
| amount | DECIMAL(15,2) | NOT NULL, > 0 | Expense amount |
| currency | TEXT | DEFAULT 'USD' | Expense currency |
| exchange_rate | DECIMAL(15,6) | DEFAULT 1 | Rate to base currency |
| description | TEXT | NULLABLE | Details |
| expense_date | DATE | NOT NULL | Date of expense |
| created_by | UUID | FK users | Creator |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

---

### ExpenseCategory

Categories for expenses.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| name | TEXT | NOT NULL | Category name |
| parent_id | UUID | FK expense_categories | Parent category |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

---

### Currency

Supported currencies.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| code | TEXT | NOT NULL | ISO code (USD, EGP) |
| name | TEXT | NOT NULL | Display name |
| symbol | TEXT | NULLABLE | Currency symbol ($, £) |
| is_default | BOOLEAN | DEFAULT false | Tenant default currency |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Constraint**: Only one is_default=true per tenant

---

### ExchangeRate

Daily exchange rates (formal and black market).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| from_currency | TEXT | NOT NULL | Source currency |
| to_currency | TEXT | DEFAULT 'USD' | Target currency |
| rate_type | ENUM | 'formal', 'black_market' | Rate type |
| rate | DECIMAL(15,6) | NOT NULL, > 0 | Exchange rate |
| effective_date | DATE | NOT NULL | Date rate applies |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Constraint**: UNIQUE(tenant_id, from_currency, to_currency, rate_type, effective_date)

---

### POSLocation

Point of sale locations.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| name | TEXT | NOT NULL | Location name |
| warehouse_id | UUID | FK warehouses, NOT NULL | Linked warehouse |
| settings | JSONB | DEFAULT '{}' | Receipt template, discount rules |
| is_active | BOOLEAN | DEFAULT true | Soft delete |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

---

### Transfer

Stock transfers between warehouses.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| from_warehouse_id | UUID | FK warehouses, NOT NULL | Source warehouse |
| to_warehouse_id | UUID | FK warehouses, NOT NULL | Destination warehouse |
| status | ENUM | 'pending', 'in_transit', 'completed', 'canceled' | Transfer status |
| notes | TEXT | NULLABLE | Comments |
| created_by | UUID | FK users | Creator |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| completed_at | TIMESTAMPTZ | NULLABLE | Completion timestamp |

**State Transitions**:
- pending → in_transit: Stock reserved at source
- in_transit → completed: Stock moved to destination
- pending/in_transit → canceled: Reserved stock released

---

### TransferItem

Items in a transfer.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| transfer_id | UUID | FK transfers, ON DELETE CASCADE | Parent transfer |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| item_id | UUID | FK items, NOT NULL | Item reference |
| quantity | DECIMAL(15,3) | NOT NULL, > 0 | Transfer quantity |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

---

### AuditLog

Comprehensive audit trail.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| user_id | UUID | FK users | Acting user |
| action | TEXT | NOT NULL | Action type (create, update, delete, login) |
| entity_type | TEXT | NOT NULL | Affected entity (item, invoice, etc.) |
| entity_id | UUID | NULLABLE | Affected entity ID |
| old_values | JSONB | NULLABLE | Previous state |
| new_values | JSONB | NULLABLE | New state |
| ip_address | INET | NULLABLE | Client IP |
| user_agent | TEXT | NULLABLE | Browser/client info |
| created_at | TIMESTAMPTZ | DEFAULT now() | Log timestamp |

---

## Accounting Module Entities (Optional Add-on)

### Account

Chart of accounts entries.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| code | TEXT | NOT NULL | Account code (1000, 1100) |
| name | TEXT | NOT NULL | Account name |
| type | ENUM | 'asset', 'liability', 'equity', 'revenue', 'expense' | Account type |
| parent_id | UUID | FK accounts | Parent account |
| balance | DECIMAL(15,2) | DEFAULT 0 | Running balance |
| is_active | BOOLEAN | DEFAULT true | Soft delete |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

---

### JournalEntry

Double-entry accounting entries.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| entry_number | TEXT | NOT NULL | Auto-generated |
| entry_date | DATE | NOT NULL | Transaction date |
| description | TEXT | NULLABLE | Entry description |
| source_type | TEXT | NULLABLE | 'manual', 'sale', 'purchase', 'payment' |
| source_id | UUID | NULLABLE | Reference to source transaction |
| is_posted | BOOLEAN | DEFAULT false | Finalized flag |
| created_by | UUID | FK users | Creator |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

---

### JournalLine

Debit/credit lines in journal entries.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| journal_entry_id | UUID | FK journal_entries, ON DELETE CASCADE | Parent entry |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| account_id | UUID | FK accounts, NOT NULL | Account reference |
| debit | DECIMAL(15,2) | DEFAULT 0 | Debit amount |
| credit | DECIMAL(15,2) | DEFAULT 0 | Credit amount |
| description | TEXT | NULLABLE | Line description |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Validation**: Sum of debits must equal sum of credits per journal entry

---

## HR Module Entities (Optional Add-on)

### Employee

Employee records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| user_id | UUID | FK users | Optional system user link |
| employee_number | TEXT | NOT NULL | Employee ID |
| full_name | TEXT | NOT NULL | Full name |
| department | TEXT | NULLABLE | Department |
| position | TEXT | NULLABLE | Job title |
| hire_date | DATE | NULLABLE | Start date |
| salary | DECIMAL(15,2) | NULLABLE | Base salary |
| salary_currency | TEXT | DEFAULT 'USD' | Salary currency |
| is_active | BOOLEAN | DEFAULT true | Employment status |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

---

### Attendance

Daily attendance records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| employee_id | UUID | FK employees, NOT NULL | Employee reference |
| date | DATE | NOT NULL | Attendance date |
| check_in | TIMESTAMPTZ | NULLABLE | Clock in time |
| check_out | TIMESTAMPTZ | NULLABLE | Clock out time |
| status | ENUM | 'present', 'absent', 'leave', 'holiday' | Day status |
| notes | TEXT | NULLABLE | Comments |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Constraint**: UNIQUE(employee_id, date)

---

### PayrollRun

Payroll processing batches.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenant_id | UUID | FK tenants, NOT NULL | Tenant ownership |
| period_start | DATE | NOT NULL | Period start |
| period_end | DATE | NOT NULL | Period end |
| status | ENUM | 'draft', 'processing', 'completed' | Run status |
| total_gross | DECIMAL(15,2) | NULLABLE | Sum of gross pay |
| total_deductions | DECIMAL(15,2) | NULLABLE | Sum of deductions |
| total_net | DECIMAL(15,2) | NULLABLE | Sum of net pay |
| created_by | UUID | FK users | Creator |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

---

## RLS Policies Summary

All tables will have the following RLS policy pattern:

```sql
-- Enable RLS
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their tenant's data
CREATE POLICY tenant_isolation ON {table_name}
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Policy: Service role bypasses RLS (for admin operations)
CREATE POLICY service_role_bypass ON {table_name}
  FOR ALL
  TO service_role
  USING (true);
```

---

## Indexes

Key indexes for performance:

```sql
-- Tenant isolation (all tables)
CREATE INDEX idx_{table}_tenant ON {table}(tenant_id);

-- Item lookups
CREATE INDEX idx_items_barcode ON items(tenant_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_items_sku ON items(tenant_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_items_name ON items(tenant_id, name);

-- Invoice queries
CREATE INDEX idx_invoices_number ON invoices(tenant_id, invoice_number);
CREATE INDEX idx_invoices_party ON invoices(tenant_id, party_id);
CREATE INDEX idx_invoices_date ON invoices(tenant_id, created_at);
CREATE INDEX idx_invoices_status ON invoices(tenant_id, status);

-- Inventory lookups
CREATE INDEX idx_inventory_item_warehouse ON inventory(tenant_id, item_id, warehouse_id);

-- Party balance queries
CREATE INDEX idx_parties_type ON parties(tenant_id, type);

-- Audit log queries
CREATE INDEX idx_audit_entity ON audit_logs(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_logs(tenant_id, created_at);
```
