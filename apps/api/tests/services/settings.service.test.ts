import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsService, SettingsError } from '../../src/services/settings.service';

/**
 * Unit tests for SettingsService.
 * Tests error class, constructor, and service methods with mocked Supabase.
 */

const settingsService = new (SettingsService as any)(null, 'test-tenant');

// ==========================================================================
// SettingsError
// ==========================================================================

describe('SettingsError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new SettingsError('bad input', 'BAD_INPUT');
    expect(err.message).toBe('bad input');
    expect(err.code).toBe('BAD_INPUT');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('SettingsError');
  });

  it('allows overriding statusCode', () => {
    const err = new SettingsError('server error', 'SERVER_ERROR', 500);
    expect(err.statusCode).toBe(500);
  });

  it('is an instance of Error', () => {
    const err = new SettingsError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new SettingsError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('SettingsError');
  });
});

// ==========================================================================
// SettingsError — all error codes used in service
// ==========================================================================

describe('SettingsError specific codes', () => {
  it('creates FETCH_FAILED error', () => {
    const err = new SettingsError('Failed to fetch settings', 'FETCH_FAILED', 500);
    expect(err.code).toBe('FETCH_FAILED');
    expect(err.statusCode).toBe(500);
  });

  it('creates TENANT_NOT_FOUND error', () => {
    const err = new SettingsError('Tenant not found', 'TENANT_NOT_FOUND', 404);
    expect(err.code).toBe('TENANT_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates UPDATE_FAILED error', () => {
    const err = new SettingsError('Failed to update', 'UPDATE_FAILED', 500);
    expect(err.code).toBe('UPDATE_FAILED');
    expect(err.statusCode).toBe(500);
  });

  it('creates RESET_FAILED error', () => {
    const err = new SettingsError('Failed to reset', 'RESET_FAILED', 500);
    expect(err.code).toBe('RESET_FAILED');
    expect(err.statusCode).toBe(500);
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('SettingsService constructor', () => {
  it('stores tenantId', () => {
    expect(settingsService.tenantId).toBe('test-tenant');
  });

  it('stores supabase client', () => {
    expect(settingsService.supabase).toBeDefined();
  });
});

// ==========================================================================
// Service methods with mocked Supabase
// ==========================================================================

function createMockSupabase(selectResult: { data: any; error: any }) {
  const maybeSingle = vi.fn().mockResolvedValue(selectResult);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { from: vi.fn().mockReturnValue({ select, update: vi.fn() }) };
}

function createMockSupabaseForUpdate(getResult: any, updateResult: any) {
  const getMaybeSingle = vi.fn().mockResolvedValue({ data: getResult, error: null });
  const getEq = vi.fn().mockReturnValue({ maybeSingle: getMaybeSingle });
  const getSelect = vi.fn().mockReturnValue({ eq: getEq });

  const updateMaybeSingle = vi.fn().mockResolvedValue({ data: updateResult, error: null });
  const updateSelect = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  let callCount = 0;
  return {
    from: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { select: getSelect };
      return { update, select: getSelect };
    }),
  };
}

describe('SettingsService.getSettings', () => {
  it('returns settings when tenant exists', async () => {
    const mockSettings = { default_language: 'en', default_theme: 'dark' };
    const mock = createMockSupabase({ data: { settings: mockSettings }, error: null });
    const svc = new (SettingsService as any)(mock, 'tenant-1');

    const result = await svc.getSettings();
    expect(result).toEqual(mockSettings);
  });

  it('throws FETCH_FAILED on database error', async () => {
    const mock = createMockSupabase({ data: null, error: { message: 'db error' } });
    const svc = new (SettingsService as any)(mock, 'tenant-1');

    await expect(svc.getSettings()).rejects.toThrow(SettingsError);
    await expect(svc.getSettings()).rejects.toThrow('Failed to fetch settings');
  });

  it('throws TENANT_NOT_FOUND when no data returned', async () => {
    const mock = createMockSupabase({ data: null, error: null });
    const svc = new (SettingsService as any)(mock, 'tenant-1');

    await expect(svc.getSettings()).rejects.toThrow('Tenant not found');
  });

  it('returns empty object when settings is null', async () => {
    const mock = createMockSupabase({ data: { settings: null }, error: null });
    const svc = new (SettingsService as any)(mock, 'tenant-1');

    const result = await svc.getSettings();
    expect(result).toEqual({});
  });
});

describe('SettingsService.resetSettings', () => {
  it('includes all expected default values', async () => {
    const svc = new (SettingsService as any)(null, 'tenant-1');
    // Mock supabase to capture the defaults
    const updateMaybeSingle = vi.fn().mockResolvedValue({
      data: { settings: {} },
      error: null,
    });
    const updateSelect = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
    const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    svc.supabase = { from: vi.fn().mockReturnValue({ update }) };

    await svc.resetSettings();

    const passedDefaults = update.mock.calls[0][0].settings;
    expect(passedDefaults.default_language).toBe('en');
    expect(passedDefaults.default_theme).toBe('light');
    expect(passedDefaults.default_currency).toBe('USD');
    expect(passedDefaults.modules).toEqual({ stock: true, accounting: false, hr: false });
    expect(passedDefaults.fiscal_year_start).toBe('01-01');
    expect(passedDefaults.date_format).toBe('YYYY-MM-DD');
    expect(passedDefaults.number_format).toEqual({ decimal_separator: '.', thousands_separator: ',' });
  });

  it('throws RESET_FAILED on database error', async () => {
    const svc = new (SettingsService as any)(null, 'tenant-1');
    const updateMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'err' } });
    const updateSelect = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
    const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    svc.supabase = { from: vi.fn().mockReturnValue({ update }) };

    await expect(svc.resetSettings()).rejects.toThrow('Failed to reset settings');
  });

  it('throws TENANT_NOT_FOUND when no data returned', async () => {
    const svc = new (SettingsService as any)(null, 'tenant-1');
    const updateMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateSelect = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
    const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    svc.supabase = { from: vi.fn().mockReturnValue({ update }) };

    await expect(svc.resetSettings()).rejects.toThrow('Tenant not found');
  });
});

describe('SettingsService.getCompanyInfo', () => {
  it('extracts only company fields from settings', async () => {
    const svc = new (SettingsService as any)(null, 'tenant-1');
    const mockSettings = {
      default_language: 'en',
      company_name: 'ACME Corp',
      company_email: 'info@acme.com',
      company_phone: '+1-555-0100',
      company_address: '123 Main St',
      tax_number: 'TX-123',
      logo_url: 'https://example.com/logo.png',
      modules: { stock: true },
    };

    // Mock getSettings
    svc.getSettings = vi.fn().mockResolvedValue(mockSettings);

    const result = await svc.getCompanyInfo();
    expect(result).toEqual({
      company_name: 'ACME Corp',
      company_email: 'info@acme.com',
      company_phone: '+1-555-0100',
      company_address: '123 Main St',
      tax_number: 'TX-123',
      logo_url: 'https://example.com/logo.png',
    });
    // Should NOT include non-company fields
    expect(result).not.toHaveProperty('default_language');
    expect(result).not.toHaveProperty('modules');
  });

  it('returns undefined for missing company fields', async () => {
    const svc = new (SettingsService as any)(null, 'tenant-1');
    svc.getSettings = vi.fn().mockResolvedValue({ default_language: 'en' });

    const result = await svc.getCompanyInfo();
    expect(result.company_name).toBeUndefined();
    expect(result.company_email).toBeUndefined();
  });
});

describe('SettingsService.toggleAccountingModule', () => {
  it('delegates to updateSettings with accounting_module_enabled', async () => {
    const svc = new (SettingsService as any)(null, 'tenant-1');
    svc.updateSettings = vi.fn().mockResolvedValue({ accounting_module_enabled: true });

    await svc.toggleAccountingModule(true);
    expect(svc.updateSettings).toHaveBeenCalledWith({ accounting_module_enabled: true });
  });

  it('can disable accounting module', async () => {
    const svc = new (SettingsService as any)(null, 'tenant-1');
    svc.updateSettings = vi.fn().mockResolvedValue({ accounting_module_enabled: false });

    await svc.toggleAccountingModule(false);
    expect(svc.updateSettings).toHaveBeenCalledWith({ accounting_module_enabled: false });
  });
});

describe('SettingsService.toggleHRModule', () => {
  it('delegates to updateSettings with hr_module_enabled', async () => {
    const svc = new (SettingsService as any)(null, 'tenant-1');
    svc.updateSettings = vi.fn().mockResolvedValue({ hr_module_enabled: true });

    await svc.toggleHRModule(true);
    expect(svc.updateSettings).toHaveBeenCalledWith({ hr_module_enabled: true });
  });
});

describe('SettingsService.getSetting', () => {
  it('returns specific setting value', async () => {
    const svc = new (SettingsService as any)(null, 'tenant-1');
    svc.getSettings = vi.fn().mockResolvedValue({ default_language: 'ar', default_theme: 'dark' });

    const result = await svc.getSetting('default_language');
    expect(result).toBe('ar');
  });

  it('returns undefined for missing key', async () => {
    const svc = new (SettingsService as any)(null, 'tenant-1');
    svc.getSettings = vi.fn().mockResolvedValue({});

    const result = await svc.getSetting('company_name');
    expect(result).toBeUndefined();
  });
});
