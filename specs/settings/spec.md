# Settings Feature Specification

## Overview

The Settings module provides comprehensive system configuration and user management capabilities for the ERP system. It includes general preferences, user management, role-based access control, currency management, exchange rates, subscription billing, and audit logging.

## Feature Components

### 1. Settings Dashboard (`/[locale]/settings`)

The main settings page displays navigation cards to all settings sections:
- General Settings
- Users Management
- Roles & Permissions
- Currencies
- Exchange Rates
- Subscription & Billing

### 2. General Settings (`/[locale]/settings/general`)

Manages tenant-wide preferences:

#### 2.1 Preferences Section
- **Default Language**: English or Arabic
- **Default Theme**: Light or Dark
- **Default Currency**: Select from available currencies
- **Date Format**: DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD

#### 2.2 Company Information Section
- **Company Logo**: Upload functionality with preview
- **Company Name**: Text input (max 255 chars)
- **Company Email**: Email validation required
- **Company Phone**: Phone number input
- **Company Address**: Textarea for address
- **Tax Number / VAT ID**: Tax identification number

#### 2.3 Business Preferences Section
- **Fiscal Year Start**: MM-DD format (e.g., 01-01)
- **Time Zone**: IANA timezone identifier

#### 2.4 Module Activation Section
- **Accounting Module**: Toggle enable/disable
- **HR Module**: Toggle enable/disable

### 3. Users Management (`/[locale]/settings/users`)

Manages user accounts with CRUD operations:

#### 3.1 User List
- Data table with pagination and search
- Columns: Name/Email, Role, Status, Language, Actions
- Sort by name, email, or created date

#### 3.2 User Form (Create/Edit)
- **Full Name**: Required, max 255 chars
- **Email**: Required, valid email format
- **Password**: Required for new users, min 8 chars
- **Role**: Select from available roles
- **Language Preference**: English or Arabic
- **Active Status**: Toggle for edit mode

#### 3.3 User Actions
- Edit user
- Activate/Deactivate user
- Delete user (with confirmation)

### 4. Roles & Permissions (`/[locale]/settings/roles`)

Manages roles with permission assignments:

#### 4.1 Role List
- Data table with pagination and search
- Columns: Role Name (with System badge), Permissions Count, Actions
- System roles cannot be deleted

#### 4.2 Permission Groups
- Items: read, write, delete
- Invoices: read, write, delete, finalize, return
- Warehouses: read, write, delete
- Transfers: read, write, complete
- Parties: read, write, delete
- Payments: read, write, delete
- Expenses: read, write, delete
- Reports: read, export
- Settings: read, write
- Users: read, write, delete
- Roles: read, write, delete
- Audit Logs: read
- Accounting: read, write
- HR: read, write

#### 4.3 Role Form
- **Role Name**: Required, max 255 chars
- **Permissions**: Checkbox selection, at least one required

### 5. Currencies (`/[locale]/settings/currencies`)

Manages currencies for multi-currency transactions:

#### 5.1 Currency List
- Data table with pagination and search
- Columns: Code (with star for default), Name, Symbol, Status, Actions
- Default currency cannot be deleted

#### 5.2 Currency Form
- **Currency Code**: 3-letter ISO code, uppercase only
- **Currency Name**: Required
- **Symbol**: Optional (e.g., $, EUR)
- **Set as Default**: Toggle

### 6. Exchange Rates (`/[locale]/settings/exchange-rates`)

Manages currency exchange rates:

#### 6.1 Exchange Rate List
- Data table with pagination and search
- Columns: From, To, Rate, Type (Formal/Black Market), Effective Date, Actions

#### 6.2 Exchange Rate Form
- **From Currency**: Required, select from currencies
- **To Currency**: Required, select from currencies
- **Exchange Rate**: Required, positive number
- **Rate Type**: Formal or Black Market
- **Effective Date**: Required, date picker

### 7. Subscription & Billing (`/[locale]/settings/subscription`)

Manages subscription plans and billing (Stripe integration):

#### 7.1 Current Plan Display
- Plan name (Freemium or Premium)
- Status badge (Active, Trialing, Canceled, Past Due)
- Next billing date (for paid plans)

#### 7.2 Usage Limits
- Items: current/limit
- Users: current/limit
- Monthly Transactions: current/limit
- Progress bars for each limit

#### 7.3 Available Plans
- **Freemium**: $0/month
  - Up to 50 items
  - 1 user
  - 25 transactions/month
  - Basic features
  - Community support

- **Premium**: $99/month
  - Unlimited items
  - Unlimited users
  - Unlimited transactions
  - PDF export
  - Priority support
  - Advanced reports
  - API access
  - Accounting module
  - HR module

#### 7.4 Billing Actions
- Upgrade to Premium (Stripe checkout)
- Manage Billing (Stripe portal)
- Cancel Subscription
- Resume Subscription (if canceled)

#### 7.5 Billing History
- List of past invoices
- Download/View invoice links

### 8. Audit Logs (`/[locale]/settings/audit-logs`)

Views system activity and changes:

#### 8.1 Audit Log List
- Data table with pagination
- Columns: Timestamp, User, Action, Entity Type, Entity ID, IP Address, Actions

#### 8.2 Filters
- Action: create, update, delete, login, logout, finalize, cancel
- Entity Type: item, invoice, party, payment, warehouse, expense, user
- Date Range: From/To date pickers

#### 8.3 Log Details
- Full timestamp
- User info (name, email)
- Action badge (color-coded)
- Entity type and ID
- IP address
- Old values (JSON)
- New values (JSON)
- User agent

## UI/UX Requirements

### Navigation
- Back arrow on all sub-pages returns to settings dashboard
- Cards on dashboard are clickable

### Forms
- Loading spinners during API calls
- Success/Error toast notifications
- Cancel button returns to previous page
- Validation messages displayed inline

### Data Tables
- Pagination with page size options
- Search functionality
- Sortable columns
- Loading skeleton during data fetch
- Empty state messages

### Responsive Design
- Grid layouts adjust to screen size
- Forms remain accessible on mobile

## i18n Requirements

All text must be translated:
- English (`/locales/en/settings.json`)
- Arabic (`/locales/ar/settings.json`)

RTL support for Arabic locale.

## Database

Database: **Supabase** (PostgreSQL)

### Related Tables
- `tenant_settings`
- `users`
- `roles`
- `currencies`
- `exchange_rates`
- `subscriptions`
- `audit_logs`

## API Endpoints

### Settings API
- `GET /api/settings` - Get tenant settings
- `PUT /api/settings` - Update tenant settings

### Users API
- `GET /api/users` - List users with pagination
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Roles API
- `GET /api/roles` - List roles
- `POST /api/roles` - Create role
- `PUT /api/roles/:id` - Update role
- `DELETE /api/roles/:id` - Delete role

### Currencies API
- `GET /api/currencies` - List currencies
- `POST /api/currencies` - Create currency
- `PUT /api/currencies/:id` - Update currency
- `DELETE /api/currencies/:id` - Delete currency

### Exchange Rates API
- `GET /api/exchange-rates` - List exchange rates
- `POST /api/exchange-rates` - Create rate
- `PUT /api/exchange-rates/:id` - Update rate
- `DELETE /api/exchange-rates/:id` - Delete rate

### Subscription API
- `GET /api/subscription` - Get current subscription
- `POST /api/subscription/checkout` - Create Stripe checkout
- `POST /api/subscription/portal` - Create Stripe portal session
- `POST /api/subscription/cancel` - Cancel subscription
- `POST /api/subscription/resume` - Resume subscription

### Audit Logs API
- `GET /api/audit-logs` - List logs with filters
