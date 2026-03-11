/**
 * Settings Service
 *
 * Business logic for tenant settings management including company information,
 * preferences, and module activation.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@erp/database';
import type { TenantSettings, UpdateTenantSettingsInput } from '@erp/shared';

/**
 * Application error for settings-related operations
 */
export class SettingsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'SettingsError';
  }
}

/**
 * Service for tenant settings management
 */
export class SettingsService {
  private readonly tenantId: string;
  private readonly supabase: SupabaseClient<Database>;

  constructor(
    supabase: SupabaseClient<Database>,
    tenantId: string
  ) {
    this.supabase = supabase;
    this.tenantId = tenantId;
  }

  /**
   * Get tenant settings
   */
  async getSettings(): Promise<TenantSettings> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('settings')
      .eq('id', this.tenantId)
      .maybeSingle();

    if (error) {
      throw new SettingsError('Failed to fetch settings', 'FETCH_FAILED', 500);
    }

    if (!data) {
      throw new SettingsError('Tenant not found', 'TENANT_NOT_FOUND', 404);
    }

    return (data.settings as unknown as TenantSettings) || {};
  }

  /**
   * Update tenant settings
   */
  async updateSettings(input: UpdateTenantSettingsInput): Promise<TenantSettings> {
    // Get current settings
    const currentSettings = await this.getSettings();

    // Merge with new settings
    const updatedSettings: TenantSettings = {
      ...currentSettings,
      ...input,
    };

    // If number_format is provided, merge it properly
    if (input.number_format) {
      updatedSettings.number_format = {
        ...currentSettings.number_format,
        ...input.number_format,
      };
    }

    // Update in database
    const { data, error } = await this.supabase
      .from('tenants')
      .update({ settings: updatedSettings as unknown as Json })
      .eq('id', this.tenantId)
      .select('settings')
      .maybeSingle();

    if (error) {
      throw new SettingsError('Failed to update settings', 'UPDATE_FAILED', 500);
    }

    if (!data) {
      throw new SettingsError('Tenant not found', 'TENANT_NOT_FOUND', 404);
    }

    return (data.settings as unknown as TenantSettings) || {};
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings(): Promise<TenantSettings> {
    const defaultSettings: TenantSettings = {
      default_language: 'en',
      default_theme: 'light',
      default_currency: 'USD',
      modules: { stock: true, accounting: false, hr: false },
      limits: { max_items: 100, max_users: 5, max_transactions_per_month: 1000 },
      accounting_module_enabled: false,
      hr_module_enabled: false,
      fiscal_year_start: '01-01',
      date_format: 'YYYY-MM-DD',
      number_format: {
        decimal_separator: '.',
        thousands_separator: ',',
      },
    };

    const { data, error } = await this.supabase
      .from('tenants')
      .update({ settings: defaultSettings as unknown as Json })
      .eq('id', this.tenantId)
      .select('settings')
      .maybeSingle();

    if (error) {
      throw new SettingsError('Failed to reset settings', 'RESET_FAILED', 500);
    }

    if (!data) {
      throw new SettingsError('Tenant not found', 'TENANT_NOT_FOUND', 404);
    }

    return (data.settings as unknown as TenantSettings) || {};
  }

  /**
   * Get specific setting value
   */
  async getSetting<K extends keyof TenantSettings>(
    key: K
  ): Promise<TenantSettings[K] | undefined> {
    const settings = await this.getSettings();
    return settings[key];
  }

  /**
   * Update specific setting value
   */
  async updateSetting<K extends keyof TenantSettings>(
    key: K,
    value: TenantSettings[K]
  ): Promise<TenantSettings> {
    return this.updateSettings({ [key]: value } as UpdateTenantSettingsInput);
  }

  /**
   * Enable/disable accounting module
   */
  async toggleAccountingModule(enabled: boolean): Promise<TenantSettings> {
    return this.updateSettings({ accounting_module_enabled: enabled });
  }

  /**
   * Enable/disable HR module
   */
  async toggleHRModule(enabled: boolean): Promise<TenantSettings> {
    return this.updateSettings({ hr_module_enabled: enabled });
  }

  /**
   * Update company information
   */
  async updateCompanyInfo(info: {
    company_name?: string;
    company_email?: string;
    company_phone?: string;
    company_address?: string;
    tax_number?: string;
    logo_url?: string;
  }): Promise<TenantSettings> {
    return this.updateSettings(info);
  }

  /**
   * Get company information
   */
  async getCompanyInfo(): Promise<{
    company_name?: string;
    company_email?: string;
    company_phone?: string;
    company_address?: string;
    tax_number?: string;
    logo_url?: string;
  }> {
    const settings = await this.getSettings();
    return {
      company_name: settings.company_name,
      company_email: settings.company_email,
      company_phone: settings.company_phone,
      company_address: settings.company_address,
      tax_number: settings.tax_number,
      logo_url: settings.logo_url,
    };
  }
}
