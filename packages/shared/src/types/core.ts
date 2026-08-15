/**
 * Core Entity Types
 *
 * Shared types for Tenant, User, and Role entities.
 * These types are used across frontend and backend.
 */

// ============================================
// ENUMS
// ============================================

export type SubscriptionPlan = 'freemium' | 'premium';

export type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'past_due';

/**
 * Payment workflow mode for invoice finalization.
 * - `dialog`: show the record-payment dialog to review/confirm (default).
 * - `background`: create the payment automatically, no dialog.
 * - `skip`: save the invoice only, never create a payment.
 */
export type PaymentFlow = 'dialog' | 'background' | 'skip';

// ============================================
// TENANT
// ============================================

export interface TenantSettings {
  default_language: 'en' | 'ar';
  default_theme: 'light' | 'dark';
  default_currency: string;
  modules: {
    stock: boolean;
    accounting: boolean;
    hr: boolean;
  };
  limits: {
    max_items: number;
    max_users: number;
    max_transactions_per_month: number;
  };
  // Company information
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  tax_number?: string;
  logo_url?: string;
  // Module toggles (flat flags used by settings service)
  accounting_module_enabled?: boolean;
  hr_module_enabled?: boolean;
  // Formatting & fiscal settings
  fiscal_year_start?: string;
  time_zone?: string;
  date_format?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  number_format?: {
    decimal_separator: '.' | ',';
    thousands_separator: ',' | '.' | ' ';
  };
  // Invoice payment workflow (per type). Unset → 'dialog' (show payment dialog).
  sales_payment_flow?: PaymentFlow;
  purchase_payment_flow?: PaymentFlow;
}

export interface Tenant {
  id: string;
  name: string;
  subscription_plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  settings: TenantSettings;
  created_at: string;
  updated_at: string;
}

export interface TenantWithFeatures extends Tenant {
  /** Computed feature flags based on subscription */
  features: {
    max_items: number;
    max_users: number;
    max_transactions_per_month: number;
    pdf_export: boolean;
    accounting_module: boolean;
    hr_module: boolean;
  };
}

// ============================================
// USER
// ============================================

export interface UserPreferences {
  language?: 'en' | 'ar';
  theme?: 'light' | 'dark';
  sidebar_collapsed?: boolean;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  role_id: string | null;
  preferences: UserPreferences;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserWithRole extends User {
  role: Role | null;
}

export interface CurrentUser extends UserWithRole {
  tenant: TenantWithFeatures;
}

// ============================================
// ROLE
// ============================================

export type Permission =
  // Wildcard
  | '*'
  // Items
  | 'items:read'
  | 'items:write'
  | 'items:delete'
  // Invoices
  | 'invoices:read'
  | 'invoices:write'
  | 'invoices:delete'
  | 'invoices:finalize'
  // Parties (customers/suppliers)
  | 'parties:read'
  | 'parties:write'
  | 'parties:delete'
  // Payments
  | 'payments:read'
  | 'payments:write'
  | 'payments:delete'
  // Warehouses
  | 'warehouses:read'
  | 'warehouses:write'
  | 'warehouses:delete'
  // Inventory
  | 'inventory:read'
  | 'inventory:write'
  // Transfers
  | 'transfers:read'
  | 'transfers:write'
  | 'transfers:complete'
  // Stock settlements (physical-count adjustments)
  | 'settlements:read'
  | 'settlements:write'
  | 'settlements:post'
  // Expenses
  | 'expenses:read'
  | 'expenses:write'
  | 'expenses:delete'
  // Reports
  | 'reports:read'
  | 'reports:export'
  // Users
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  // Roles
  | 'roles:read'
  | 'roles:write'
  | 'roles:delete'
  // Settings
  | 'settings:read'
  | 'settings:write'
  // Accounting module
  | 'accounting:read'
  | 'accounting:write'
  // HR module
  | 'hr:read'
  | 'hr:write'
  // Categories
  | 'categories:read'
  | 'categories:write'
  | 'categories:delete'
  // Employees
  | 'employees:read'
  | 'employees:write'
  | 'employees:delete'
  // Attendance
  | 'attendance:read'
  | 'attendance:write'
  | 'attendance:delete'
  // Journal Entries
  | 'journal_entries:read'
  | 'journal_entries:write'
  | 'journal_entries:delete'
  // Payroll
  | 'payroll:read'
  | 'payroll:write'
  | 'payroll:delete'
  // POS
  | 'pos:read'
  | 'pos:write'
  | 'pos:delete'
  // Currencies
  | 'currencies:read'
  | 'currencies:write'
  | 'currencies:delete'
  // Exchange Rates
  | 'exchange_rates:read'
  | 'exchange_rates:write'
  | 'exchange_rates:delete'
  // Accounts (Chart of Accounts)
  | 'accounts:read'
  | 'accounts:write'
  | 'accounts:delete';

export interface Role {
  id: string;
  tenant_id: string;
  name: string;
  permissions: Permission[];
  is_system: boolean;
  created_at: string;
}

export type SystemRoleName = 'admin' | 'sales' | 'warehouse' | 'viewer';

// ============================================
// AUTH
// ============================================

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: CurrentUser;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  tenant_name: string;
  full_name?: string;
}

// ============================================
// JWT CLAIMS
// ============================================

export interface JWTClaims {
  sub: string; // User ID
  email: string;
  tenant_id: string;
  role: string;
  permissions: Permission[];
  iat: number;
  exp: number;
}
