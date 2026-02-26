# Settings Feature - Implementation Tasks

## Overview

This document outlines the implementation details for the Settings feature.

## Technology Stack

- **Frontend**: Next.js 14 with App Router
- **UI**: React, TypeScript, Tailwind CSS, shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod validation
- **i18n**: next-intl
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe

## File Structure

```
apps/web/src/app/[locale]/(dashboard)/settings/
├── page.tsx                    # Settings dashboard
├── general/page.tsx            # General settings
├── users/page.tsx              # Users management
├── roles/page.tsx              # Roles & permissions
├── currencies/page.tsx         # Currencies management
├── exchange-rates/page.tsx     # Exchange rates
├── subscription/page.tsx       # Subscription & billing
├── audit-logs/page.tsx         # Audit logs viewer
└── ai-admin/page.tsx           # AI admin settings

apps/web/src/locales/
├── en/settings.json            # English translations
└── ar/settings.json            # Arabic translations

apps/web/src/hooks/
├── use-settings.ts             # Tenant settings hooks
├── use-users.ts                # Users CRUD hooks
├── use-roles.ts                # Roles CRUD hooks
├── use-currencies.ts           # Currencies CRUD hooks
├── use-exchange-rates.ts       # Exchange rates hooks
├── use-subscription.ts         # Subscription hooks
└── use-audit-logs.ts           # Audit logs hooks
```

## Implementation Details

### 1. Settings Dashboard

**Route**: `/[locale]/settings`
**Component**: `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx`

Features:
- Grid of 6 navigation cards
- Each card: icon, title, description
- Click navigates to sub-page
- Responsive grid (1-3 columns)

### 2. General Settings

**Route**: `/[locale]/settings/general`
**Component**: `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx`

Form Schema (Zod):
```typescript
const settingsFormSchema = z.object({
  default_language: z.enum(['en', 'ar']).optional(),
  default_theme: z.enum(['light', 'dark']).optional(),
  default_currency: z.string().optional(),
  company_name: z.string().max(255).optional(),
  company_email: z.string().email().max(255).optional().or(z.literal('')),
  company_phone: z.string().max(50).optional(),
  company_address: z.string().max(500).optional(),
  tax_number: z.string().max(50).optional(),
  logo_url: z.string().url().optional().or(z.literal('')).nullable(),
  accounting_module_enabled: z.boolean().optional(),
  hr_module_enabled: z.boolean().optional(),
  fiscal_year_start: z.string().optional(),
  time_zone: z.string().optional(),
  date_format: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
});
```

Hooks:
- `useTenantSettings()` - Fetch settings
- `useUpdateTenantSettings()` - Update settings
- `useCurrencies()` - Fetch currencies for dropdown

### 3. Users Management

**Route**: `/[locale]/settings/users`
**Component**: `apps/web/src/app/[locale]/(dashboard)/settings/users/page.tsx`

Form Schema:
```typescript
const userFormSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(255),
  role_id: z.string().optional(),
  password: z.string().min(8).optional(),
  is_active: z.boolean().default(true),
  preferences: z.object({
    language: z.enum(['en', 'ar']).optional(),
    theme: z.enum(['light', 'dark']).optional(),
  }).optional(),
});
```

Hooks:
- `useUsers(params)` - Fetch users with pagination
- `useCreateUser()` - Create new user
- `useUpdateUser()` - Update user
- `useDeleteUser()` - Delete user
- `useRoles()` - Fetch roles for dropdown

### 4. Roles & Permissions

**Route**: `/[locale]/settings/roles`
**Component**: `apps/web/src/app/[locale]/(dashboard)/settings/roles/page.tsx`

Form Schema:
```typescript
const roleFormSchema = z.object({
  name: z.string().min(1).max(255),
  permissions: z.array(z.string()).min(1),
});
```

Permission Groups:
```typescript
const permissionGroups = {
  Items: ['items:read', 'items:write', 'items:delete'],
  Invoices: ['invoices:read', 'invoices:write', 'invoices:delete', 'invoices:finalize', 'invoices:return'],
  Warehouses: ['warehouses:read', 'warehouses:write', 'warehouses:delete'],
  // ... other groups
};
```

### 5. Currencies

**Route**: `/[locale]/settings/currencies`
**Component**: `apps/web/src/app/[locale]/(dashboard)/settings/currencies/page.tsx`

Form Schema:
```typescript
const currencyFormSchema = z.object({
  code: z.string().min(3).max(3).toUpperCase(),
  name: z.string().min(1).max(255),
  symbol: z.string().max(10).optional(),
  is_default: z.boolean().default(false),
});
```

### 6. Exchange Rates

**Route**: `/[locale]/settings/exchange-rates`
**Component**: `apps/web/src/app/[locale]/(dashboard)/settings/exchange-rates/page.tsx`

Form Schema:
```typescript
const exchangeRateFormSchema = z.object({
  from_currency: z.string().min(1),
  to_currency: z.string().min(1),
  rate_type: z.enum(['formal', 'black_market']).default('formal'),
  rate: z.coerce.number().positive(),
  effective_date: z.string().min(1),
});
```

### 7. Subscription & Billing

**Route**: `/[locale]/settings/subscription`
**Component**: `apps/web/src/app/[locale]/(dashboard)/settings/subscription/page.tsx`

Plans:
```typescript
const plans = [
  {
    id: 'freemium',
    price: '$0',
    limits: { items: 50, users: 1, transactions: 25, pdf_export: false }
  },
  {
    id: 'premium',
    price: '$99',
    limits: { items: 'Unlimited', users: 'Unlimited', transactions: 'Unlimited', pdf_export: true }
  }
];
```

Hooks:
- `useSubscription()` - Get current subscription
- `useSubscriptionLimits()` - Get usage limits
- `useBillingHistory()` - Get invoices
- `useCreateCheckoutSession()` - Create Stripe checkout
- `useCreatePortalSession()` - Create Stripe portal
- `useCancelSubscription()` - Cancel subscription
- `useResumeSubscription()` - Resume subscription

### 8. Audit Logs

**Route**: `/[locale]/settings/audit-logs`
**Component**: `apps/web/src/app/[locale]/(dashboard)/settings/audit-logs/page.tsx`

Query Params:
```typescript
interface AuditLogQueryParams {
  page: number;
  limit: number;
  userId?: string;
  entityType?: AuditEntityType;
  action?: AuditAction;
  dateFrom?: string;
  dateTo?: string;
}
```

Action Colors:
```typescript
const actionColors = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  login: 'bg-purple-100 text-purple-800',
  logout: 'bg-gray-100 text-gray-800',
  finalize: 'bg-yellow-100 text-yellow-800',
  cancel: 'bg-orange-100 text-orange-800',
  return: 'bg-pink-100 text-pink-800',
  transfer: 'bg-indigo-100 text-indigo-800',
  export: 'bg-teal-100 text-teal-800',
  import: 'bg-cyan-100 text-cyan-800',
};
```

## Database Schema

### tenant_settings
```sql
CREATE TABLE tenant_settings (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  default_language VARCHAR(2) DEFAULT 'en',
  default_theme VARCHAR(10) DEFAULT 'light',
  default_currency VARCHAR(3),
  company_name VARCHAR(255),
  company_email VARCHAR(255),
  company_phone VARCHAR(50),
  company_address TEXT,
  tax_number VARCHAR(50),
  logo_url TEXT,
  fiscal_year_start VARCHAR(5),
  time_zone VARCHAR(50),
  date_format VARCHAR(20),
  accounting_module_enabled BOOLEAN DEFAULT false,
  hr_module_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role_id UUID REFERENCES roles(id),
  is_active BOOLEAN DEFAULT true,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### roles
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  permissions TEXT[] NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### currencies
```sql
CREATE TABLE currencies (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  code VARCHAR(3) NOT NULL,
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(10),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### exchange_rates
```sql
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(20,6) NOT NULL,
  rate_type VARCHAR(20) DEFAULT 'formal',
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  plan VARCHAR(20) DEFAULT 'freemium',
  status VARCHAR(20) DEFAULT 'active',
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### audit_logs
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Testing Checklist

### General Settings
- [ ] Page loads with all sections
- [ ] Language dropdown works
- [ ] Theme dropdown works
- [ ] Currency dropdown populates
- [ ] Date format dropdown works
- [ ] Company info fields save
- [ ] Email validation works
- [ ] Logo upload works
- [ ] Module toggles work
- [ ] Save button works
- [ ] Cancel button navigates back
- [ ] Toast notifications appear

### Users Management
- [ ] Data table loads
- [ ] Pagination works
- [ ] Search filters results
- [ ] Add User button opens dialog
- [ ] Create user works
- [ ] Edit user works
- [ ] Activate/Deactivate works
- [ ] Delete user works
- [ ] Form validation works

### Roles & Permissions
- [ ] Data table loads
- [ ] Add Role button opens dialog
- [ ] Permission checkboxes work
- [ ] Create role works
- [ ] Edit role works
- [ ] Delete role works
- [ ] System roles protected

### Currencies
- [ ] Data table loads
- [ ] Add Currency works
- [ ] Code validates to 3 chars
- [ ] Set as Default works
- [ ] Default cannot be deleted
- [ ] Edit/Delete works

### Exchange Rates
- [ ] Data table loads
- [ ] Currency dropdowns populate
- [ ] Rate validation works
- [ ] Rate type selection works
- [ ] Date picker works
- [ ] CRUD operations work

### Subscription
- [ ] Current plan displays
- [ ] Usage limits show
- [ ] Plan cards display
- [ ] Upgrade button works
- [ ] Manage Billing works
- [ ] Cancel flow works
- [ ] Resume works

### Audit Logs
- [ ] Data table loads
- [ ] Filters work
- [ ] View Details works
- [ ] Export button present
