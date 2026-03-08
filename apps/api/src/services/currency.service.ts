/**
 * Currency Service
 *
 * Business logic for currency management.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import type { Currency } from '@erp/shared';
import { CurrencyRepository } from '../repositories/currency.repository';
import type { QueryResult } from '../repositories/base.repository';

/**
 * Application error for currency-related operations
 */
export class CurrencyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'CurrencyError';
  }
}

/**
 * Service for Currency business logic
 */
export class CurrencyService {
  private readonly repository: CurrencyRepository;
  private readonly tenantId: string;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.repository = new CurrencyRepository(supabase);
    this.tenantId = tenantId;
  }

  /**
   * List currencies with pagination
   */
  async getCurrencies(params: {
    page?: number;
    limit?: number;
  }): Promise<QueryResult<Currency>> {
    return this.repository.findAll({
      tenantId: this.tenantId,
      page: params.page || 1,
      limit: params.limit || 50,
    });
  }

  /**
   * Get a single currency by ID
   */
  async getCurrency(id: string): Promise<Currency> {
    const currency = await this.repository.findById(this.tenantId, id);
    if (!currency) {
      throw new CurrencyError('Currency not found', 'CURRENCY_NOT_FOUND', 404);
    }
    return currency;
  }

  /**
   * Get a currency by code
   */
  async getCurrencyByCode(code: string): Promise<Currency> {
    const currency = await this.repository.findByCode(this.tenantId, code);
    if (!currency) {
      throw new CurrencyError('Currency not found', 'CURRENCY_NOT_FOUND', 404);
    }
    return currency;
  }

  /**
   * Create a new currency
   */
  async createCurrency(input: {
    code: string;
    name: string;
    symbol?: string;
    is_default?: boolean;
  }): Promise<Currency> {
    const codeExists = await this.repository.codeExists(this.tenantId, input.code);
    if (codeExists) {
      throw new CurrencyError('A currency with this code already exists', 'CURRENCY_CODE_EXISTS');
    }

    return this.repository.create(this.tenantId, {
      code: input.code.toUpperCase(),
      name: input.name,
      symbol: input.symbol ?? undefined,
      is_default: input.is_default || false,
    });
  }

  /**
   * Update a currency
   */
  async updateCurrency(id: string, input: {
    code?: string;
    name?: string;
    symbol?: string;
    is_default?: boolean;
  }): Promise<Currency> {
    const existing = await this.repository.findById(this.tenantId, id);
    if (!existing) {
      throw new CurrencyError('Currency not found', 'CURRENCY_NOT_FOUND', 404);
    }

    if (input.code && input.code !== existing.code) {
      const codeExists = await this.repository.codeExists(this.tenantId, input.code, id);
      if (codeExists) {
        throw new CurrencyError('A currency with this code already exists', 'CURRENCY_CODE_EXISTS');
      }
    }

    const updates: Record<string, unknown> = {};
    if (input.code !== undefined) updates.code = input.code.toUpperCase();
    if (input.name !== undefined) updates.name = input.name;
    if (input.symbol !== undefined) updates.symbol = input.symbol;
    if (input.is_default !== undefined) updates.is_default = input.is_default;

    const currency = await this.repository.update(this.tenantId, id, updates);
    if (!currency) {
      throw new CurrencyError('Failed to update currency', 'UPDATE_FAILED', 500);
    }

    return currency;
  }

  /**
   * Delete a currency
   */
  async deleteCurrency(id: string): Promise<void> {
    const existing = await this.repository.findById(this.tenantId, id);
    if (!existing) {
      throw new CurrencyError('Currency not found', 'CURRENCY_NOT_FOUND', 404);
    }

    if (existing.is_default) {
      throw new CurrencyError(
        'Cannot delete the default currency. Set another currency as default first.',
        'CANNOT_DELETE_DEFAULT'
      );
    }

    const deleted = await this.repository.delete(this.tenantId, id);
    if (!deleted) {
      throw new CurrencyError('Failed to delete currency', 'DELETE_FAILED', 500);
    }
  }

  /**
   * Get the default currency
   */
  async getDefaultCurrency(): Promise<Currency> {
    const currency = await this.repository.getDefault(this.tenantId);
    if (!currency) {
      throw new CurrencyError('No default currency set', 'NO_DEFAULT_CURRENCY', 404);
    }
    return currency;
  }

  /**
   * Set a currency as the default
   */
  async setDefault(id: string): Promise<Currency> {
    const existing = await this.repository.findById(this.tenantId, id);
    if (!existing) {
      throw new CurrencyError('Currency not found', 'CURRENCY_NOT_FOUND', 404);
    }

    const currency = await this.repository.setDefault(this.tenantId, id);
    if (!currency) {
      throw new CurrencyError('Failed to set default currency', 'SET_DEFAULT_FAILED', 500);
    }

    return currency;
  }
}
