// Settings and Currency Types for Modular ERP SaaS
// Covers: Currency management, Exchange rates

export type RateType = 'formal' | 'black_market';

export interface Currency {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  symbol?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
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

export interface CreateRoleInput {
  name: string;
  permissions: string[];
}

export interface UpdateRoleInput {
  name?: string;
  permissions?: string[];
}
