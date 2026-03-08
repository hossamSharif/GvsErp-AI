// Settings and Currency Types for Modular ERP SaaS
// Covers: Currency management, Exchange rates, Tenant settings

export type RateType = 'formal' | 'black_market';

export interface Currency {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  symbol?: string;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateCurrencyInput {
  code: string;
  name: string;
  symbol?: string;
  is_default?: boolean;
}

export interface UpdateCurrencyInput {
  code?: string;
  name?: string;
  symbol?: string;
  is_default?: boolean;
}

export interface ExchangeRate {
  id: string;
  tenant_id: string;
  from_currency: string;
  to_currency: string;
  rate_type: RateType;
  rate: number;
  effective_date: string; // ISO date string
  created_at?: string;
  updated_at?: string;
}

export interface CreateExchangeRateInput {
  from_currency: string;
  to_currency?: string;
  rate_type?: RateType;
  rate: number;
  effective_date: string; // ISO date string
}

export interface UpdateExchangeRateInput {
  from_currency?: string;
  to_currency?: string;
  rate_type?: RateType;
  rate?: number;
  effective_date?: string;
}

// TenantSettings is defined in core.ts — use that as the authoritative source

export interface UpdateTenantSettingsInput {
  default_language?: 'en' | 'ar';
  default_theme?: 'light' | 'dark';
  default_currency?: string;
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  tax_number?: string;
  logo_url?: string;
  accounting_module_enabled?: boolean;
  hr_module_enabled?: boolean;
  fiscal_year_start?: string;
  time_zone?: string;
  date_format?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  number_format?: {
    decimal_separator: '.' | ',';
    thousands_separator: ',' | '.' | ' ';
  };
}

// User is defined in core.ts — use that as the authoritative source

export interface CreateUserInput {
  email: string;
  full_name?: string;
  role_id?: string;
  password: string;
  preferences?: {
    language?: 'en' | 'ar';
    theme?: 'light' | 'dark';
  };
}

export interface UpdateUserInput {
  email?: string;
  full_name?: string;
  role_id?: string;
  preferences?: {
    language?: 'en' | 'ar';
    theme?: 'light' | 'dark';
  };
  is_active?: boolean;
}

// Role is defined in core.ts — use that as the authoritative source

export interface CreateRoleInput {
  name: string;
  permissions: string[];
}

export interface UpdateRoleInput {
  name?: string;
  permissions?: string[];
}

// Permission constants
export const PERMISSIONS = {
  // Items
  ITEMS_READ: 'items:read',
  ITEMS_WRITE: 'items:write',
  ITEMS_DELETE: 'items:delete',

  // Invoices (Sales & Purchases)
  INVOICES_READ: 'invoices:read',
  INVOICES_WRITE: 'invoices:write',
  INVOICES_DELETE: 'invoices:delete',
  INVOICES_FINALIZE: 'invoices:finalize',
  INVOICES_RETURN: 'invoices:return',

  // Warehouses
  WAREHOUSES_READ: 'warehouses:read',
  WAREHOUSES_WRITE: 'warehouses:write',
  WAREHOUSES_DELETE: 'warehouses:delete',

  // Transfers
  TRANSFERS_READ: 'transfers:read',
  TRANSFERS_WRITE: 'transfers:write',
  TRANSFERS_COMPLETE: 'transfers:complete',

  // Parties (Customers & Suppliers)
  PARTIES_READ: 'parties:read',
  PARTIES_WRITE: 'parties:write',
  PARTIES_DELETE: 'parties:delete',

  // Payments
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_WRITE: 'payments:write',
  PAYMENTS_DELETE: 'payments:delete',

  // Expenses
  EXPENSES_READ: 'expenses:read',
  EXPENSES_WRITE: 'expenses:write',
  EXPENSES_DELETE: 'expenses:delete',

  // Reports
  REPORTS_READ: 'reports:read',
  REPORTS_EXPORT: 'reports:export',

  // Settings
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',

  // Users
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',

  // Roles
  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',
  ROLES_DELETE: 'roles:delete',

  // Audit Logs
  AUDIT_READ: 'audit:read',

  // Accounting Module
  ACCOUNTING_READ: 'accounting:read',
  ACCOUNTING_WRITE: 'accounting:write',

  // HR Module
  HR_READ: 'hr:read',
  HR_WRITE: 'hr:write',
} as const;

// System role templates
export const SYSTEM_ROLES = {
  ADMIN: {
    name: 'Admin',
    permissions: Object.values(PERMISSIONS),
  },
  SALES: {
    name: 'Sales',
    permissions: [
      PERMISSIONS.ITEMS_READ,
      PERMISSIONS.INVOICES_READ,
      PERMISSIONS.INVOICES_WRITE,
      PERMISSIONS.INVOICES_FINALIZE,
      PERMISSIONS.INVOICES_RETURN,
      PERMISSIONS.PARTIES_READ,
      PERMISSIONS.PARTIES_WRITE,
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.PAYMENTS_WRITE,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.REPORTS_EXPORT,
    ],
  },
  WAREHOUSE: {
    name: 'Warehouse',
    permissions: [
      PERMISSIONS.ITEMS_READ,
      PERMISSIONS.ITEMS_WRITE,
      PERMISSIONS.WAREHOUSES_READ,
      PERMISSIONS.WAREHOUSES_WRITE,
      PERMISSIONS.TRANSFERS_READ,
      PERMISSIONS.TRANSFERS_WRITE,
      PERMISSIONS.TRANSFERS_COMPLETE,
      PERMISSIONS.REPORTS_READ,
    ],
  },
  VIEWER: {
    name: 'Viewer',
    permissions: [
      PERMISSIONS.ITEMS_READ,
      PERMISSIONS.INVOICES_READ,
      PERMISSIONS.WAREHOUSES_READ,
      PERMISSIONS.TRANSFERS_READ,
      PERMISSIONS.PARTIES_READ,
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.EXPENSES_READ,
      PERMISSIONS.REPORTS_READ,
    ],
  },
} as const;
