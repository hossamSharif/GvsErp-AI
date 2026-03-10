/**
 * Exchange Rate Service
 *
 * Business logic for exchange rate management.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import type { ExchangeRate } from '@erp/shared';
import { ExchangeRateRepository } from '../repositories/currency.repository';
import type { QueryResult } from '../repositories/base.repository';

/**
 * Application error for exchange rate-related operations
 */
export class ExchangeRateError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ExchangeRateError';
  }
}

/**
 * Service for Exchange Rate business logic
 */
export class ExchangeRateService {
  private readonly repository: ExchangeRateRepository;
  private readonly tenantId: string;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.repository = new ExchangeRateRepository(supabase);
    this.tenantId = tenantId;
  }

  /**
   * List exchange rates with pagination and sorting
   */
  async getRates(params: {
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<QueryResult<ExchangeRate>> {
    return this.repository.findAll({
      tenantId: this.tenantId,
      page: params.page || 1,
      limit: params.limit || 50,
      sort_by: params.sort_by || 'effective_date',
      sort_order: params.sort_order || 'desc',
    });
  }

  /**
   * Get a single exchange rate by ID
   */
  async getRate(id: string): Promise<ExchangeRate> {
    const rate = await this.repository.findById(this.tenantId, id);
    if (!rate) {
      throw new ExchangeRateError('Exchange rate not found', 'RATE_NOT_FOUND', 404);
    }
    return rate;
  }

  /**
   * Create a new exchange rate
   */
  async createRate(input: {
    from_currency: string;
    to_currency?: string;
    rate_type?: string;
    rate: number;
    effective_date: string;
  }): Promise<ExchangeRate> {
    const fromCurrency = input.from_currency.toUpperCase();
    const toCurrency = (input.to_currency || 'USD').toUpperCase();
    const rateType = (input.rate_type || 'formal') as 'formal' | 'black_market';

    const exists = await this.repository.rateExists(
      this.tenantId,
      fromCurrency,
      toCurrency,
      rateType,
      input.effective_date
    );

    if (exists) {
      throw new ExchangeRateError(
        'An exchange rate for this currency pair, type, and date already exists',
        'RATE_EXISTS'
      );
    }

    return this.repository.create(this.tenantId, {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      rate_type: rateType,
      rate: input.rate,
      effective_date: input.effective_date,
    });
  }

  /**
   * Update an exchange rate
   */
  async updateRate(id: string, input: {
    from_currency?: string;
    to_currency?: string;
    rate_type?: string;
    rate?: number;
    effective_date?: string;
  }): Promise<ExchangeRate> {
    const existing = await this.repository.findById(this.tenantId, id);
    if (!existing) {
      throw new ExchangeRateError('Exchange rate not found', 'RATE_NOT_FOUND', 404);
    }

    const fromCurrency = input.from_currency?.toUpperCase() || existing.from_currency;
    const toCurrency = input.to_currency?.toUpperCase() || existing.to_currency;
    const rateType = (input.rate_type || existing.rate_type) as 'formal' | 'black_market';
    const effectiveDate = input.effective_date || existing.effective_date;

    // Check for duplicates if key fields changed
    if (input.from_currency || input.to_currency || input.rate_type || input.effective_date) {
      const exists = await this.repository.rateExists(
        this.tenantId,
        fromCurrency,
        toCurrency,
        rateType,
        effectiveDate,
        id
      );

      if (exists) {
        throw new ExchangeRateError(
          'An exchange rate for this currency pair, type, and date already exists',
          'RATE_EXISTS'
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (input.from_currency !== undefined) updates.from_currency = fromCurrency;
    if (input.to_currency !== undefined) updates.to_currency = toCurrency;
    if (input.rate_type !== undefined) updates.rate_type = rateType;
    if (input.rate !== undefined) updates.rate = input.rate;
    if (input.effective_date !== undefined) updates.effective_date = effectiveDate;

    const rate = await this.repository.update(this.tenantId, id, updates);
    if (!rate) {
      throw new ExchangeRateError('Failed to update exchange rate', 'UPDATE_FAILED', 500);
    }

    return rate;
  }

  /**
   * Delete an exchange rate
   */
  async deleteRate(id: string): Promise<void> {
    const deleted = await this.repository.delete(this.tenantId, id);
    if (!deleted) {
      throw new ExchangeRateError('Exchange rate not found', 'RATE_NOT_FOUND', 404);
    }
  }

  /**
   * Get the latest exchange rate for a currency pair
   */
  async getLatestRate(params: {
    from: string;
    to?: string;
    type?: 'formal' | 'black_market';
    asOfDate?: string;
  }): Promise<ExchangeRate> {
    const rate = await this.repository.getLatestRate(
      this.tenantId,
      params.from.toUpperCase(),
      (params.to || 'USD').toUpperCase(),
      params.type || 'formal',
      params.asOfDate
    );

    if (!rate) {
      throw new ExchangeRateError(
        'No exchange rate found for the specified criteria',
        'RATE_NOT_FOUND',
        404
      );
    }

    return rate;
  }

  /**
   * Get exchange rates within a date range
   */
  async getRatesInRange(params: {
    from: string;
    to?: string;
    type?: 'formal' | 'black_market';
    startDate: string;
    endDate: string;
  }): Promise<ExchangeRate[]> {
    return this.repository.getRatesInRange(
      this.tenantId,
      params.from.toUpperCase(),
      (params.to || 'USD').toUpperCase(),
      params.type || 'formal',
      params.startDate,
      params.endDate
    );
  }
}
