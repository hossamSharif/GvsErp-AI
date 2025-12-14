// Zod Validation Schemas for Settings Module
import { z } from 'zod';

// Rate type enum
export const rateTypeSchema = z.enum(['formal', 'black_market']);

// Currency validation schemas
export const createCurrencySchema = z.object({
  code: z.string().min(2).max(5).toUpperCase(),
  name: z.string().min(1).max(255),
  symbol: z.string().max(10).optional(),
  is_default: z.boolean().optional().default(false),
});

export const updateCurrencySchema = z.object({
  code: z.string().min(2).max(5).toUpperCase().optional(),
  name: z.string().min(1).max(255).optional(),
  symbol: z.string().max(10).optional(),
  is_default: z.boolean().optional(),
});

// Exchange rate validation schemas
export const createExchangeRateSchema = z.object({
  from_currency: z.string().min(2).max(5).toUpperCase(),
  to_currency: z.string().min(2).max(5).toUpperCase().optional().default('USD'),
  rate_type: rateTypeSchema.optional().default('formal'),
  rate: z.number().positive(),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO date format
}).refine(data => data.from_currency !== data.to_currency, {
  message: 'from_currency and to_currency must be different',
  path: ['from_currency'],
});

export const updateExchangeRateSchema = z.object({
  from_currency: z.string().min(2).max(5).toUpperCase().optional(),
  to_currency: z.string().min(2).max(5).toUpperCase().optional(),
  rate_type: rateTypeSchema.optional(),
  rate: z.number().positive().optional(),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Tenant settings validation schema
export const updateTenantSettingsSchema = z.object({
  default_language: z.enum(['en', 'ar']).optional(),
  default_theme: z.enum(['light', 'dark']).optional(),
  default_currency: z.string().min(2).max(5).toUpperCase().optional(),
  company_name: z.string().min(1).max(255).optional(),
  company_email: z.string().email().optional(),
  company_phone: z.string().max(50).optional(),
  company_address: z.string().max(500).optional(),
  tax_number: z.string().max(50).optional(),
  logo_url: z.string().url().optional(),
  accounting_module_enabled: z.boolean().optional(),
  hr_module_enabled: z.boolean().optional(),
  fiscal_year_start: z.string().regex(/^\d{2}-\d{2}$/).optional(), // MM-DD format
  time_zone: z.string().optional(),
  date_format: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
  number_format: z.object({
    decimal_separator: z.enum(['.', ',']),
    thousands_separator: z.enum([',', '.', ' ']),
  }).optional(),
});

// User validation schemas
export const createUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(255).optional(),
  role_id: z.string().uuid().optional(),
  password: z.string().min(8).max(100),
  preferences: z.object({
    language: z.enum(['en', 'ar']).optional(),
    theme: z.enum(['light', 'dark']).optional(),
  }).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  full_name: z.string().min(1).max(255).optional(),
  role_id: z.string().uuid().optional(),
  preferences: z.object({
    language: z.enum(['en', 'ar']).optional(),
    theme: z.enum(['light', 'dark']).optional(),
  }).optional(),
  is_active: z.boolean().optional(),
});

// Role validation schemas
export const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).min(1),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.string()).min(1).optional(),
});

// Export all schemas
export const settingsValidation = {
  createCurrency: createCurrencySchema,
  updateCurrency: updateCurrencySchema,
  createExchangeRate: createExchangeRateSchema,
  updateExchangeRate: updateExchangeRateSchema,
  updateTenantSettings: updateTenantSettingsSchema,
  createUser: createUserSchema,
  updateUser: updateUserSchema,
  createRole: createRoleSchema,
  updateRole: updateRoleSchema,
};
