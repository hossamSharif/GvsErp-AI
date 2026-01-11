# Parties Feature Specification

## Overview
The Parties module manages customers and suppliers in the ERP system. It provides a unified interface for managing both party types with shared functionality.

## Core Features

### 1. Parties List Page (`/ar/parties`)
- **Tabbed Interface**: Customers and Suppliers tabs with counts
- **Data Table**: Name, Email, Phone, Balance, Tax Number, Status, Actions
- **Actions per row**:
  - View Party (eye icon)
  - Edit Party (pencil icon)
  - Record/Make Payment (dollar icon)
  - Delete Party (trash icon, red)
- **Header Actions**:
  - Export button
  - Add Customer/Supplier button (context-aware)
- **Search**: Search by name
- **Pagination**: 20 items per page default

### 2. Customer/Supplier Detail Pages (`/ar/customers/[id]`, `/ar/suppliers/[id]`)
- **Contact Info Card**: Email, Phone, Address, Tax Number, Status
- **Balance Card**: Current balance with receivable/overpaid/settled status
- **Summary Card**: Total invoiced, Total paid, Transaction count
- **Transaction History Table**: Date, Type, Reference, Description, Debit, Credit, Balance
- **Actions**: Edit, Record Payment, Recalculate Balance, Back

### 3. Create Customer/Supplier Pages (`/ar/customers/new`, `/ar/suppliers/new`)
- **Form Fields**:
  - Name (required)
  - Email (optional)
  - Phone (optional)
  - Address (optional)
  - Tax Number (optional)
  - Notes (optional)
  - Status (edit mode only)
- **Validation**:
  - Name: required, max 255 chars
  - Email: valid email format, max 255 chars
  - Phone: max 50 chars
  - Address: max 500 chars
  - Tax Number: max 50 chars
  - Notes: max 2000 chars

### 4. Customer Balance Report (`/ar/customers/report`)
- Report generation with filters
- PDF export functionality

## API Endpoints

### CRUD Operations
- `GET /api/parties` - List with pagination, search, filters
- `POST /api/parties` - Create party
- `GET /api/parties/:id` - Get single party
- `PUT /api/parties/:id` - Update party
- `DELETE /api/parties/:id` - Delete party (soft delete)

### Balance Operations
- `GET /api/parties/:id/balance` - Get balance
- `POST /api/parties/:id/recalculate-balance` - Recalculate balance
- `GET /api/parties/:id/statement` - Get transaction history

### Reports
- `GET /api/parties/summary/balances` - Balance summary
- `GET /api/parties/reports/customer-balances` - Customer balance report

## i18n Requirements

### Arabic Translations (parties namespace)
- parties.title: الأطراف
- parties.customers: العملاء
- parties.suppliers: الموردين
- parties.addCustomer: إضافة عميل
- parties.addSupplier: إضافة مورد
- parties.editParty: تعديل
- parties.viewParty: عرض التفاصيل
- parties.deleteParty: حذف
- parties.fields.name: الاسم
- parties.fields.email: البريد الإلكتروني
- parties.fields.phone: الهاتف
- parties.fields.address: العنوان
- parties.fields.taxNumber: الرقم الضريبي
- parties.fields.balance: الرصيد

### Common Translations
- common.status: الحالة
- common.active: نشط
- common.inactive: غير نشط
- common.actions: إجراءات
- common.export: تصدير
- common.search: بحث
- common.save: حفظ
- common.cancel: إلغاء
- common.delete: حذف

## Database Schema

### parties table
- id: UUID (PK)
- tenant_id: UUID (FK)
- type: 'customer' | 'supplier'
- name: VARCHAR(255) NOT NULL
- email: VARCHAR(255)
- phone: VARCHAR(50)
- address: TEXT
- tax_number: VARCHAR(50)
- notes: TEXT
- balance: DECIMAL(15,2) DEFAULT 0
- is_active: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- deleted_at: TIMESTAMP (soft delete)

## UI Components Used
- DataTable with pagination and sorting
- Tabs component for customer/supplier switch
- DropdownMenu for row actions
- AlertDialog for delete confirmation
- Card components for detail page sections
- Form with react-hook-form + zod validation
- Badge for status display
- Toast for notifications

## Routes Structure
```
/[locale]/parties           - Main parties page with tabs
/[locale]/customers         - Customers list (standalone)
/[locale]/customers/new     - Create customer
/[locale]/customers/[id]    - Customer detail/edit
/[locale]/customers/report  - Customer balance report
/[locale]/suppliers         - Suppliers list (standalone)
/[locale]/suppliers/new     - Create supplier
/[locale]/suppliers/[id]    - Supplier detail/edit
```
