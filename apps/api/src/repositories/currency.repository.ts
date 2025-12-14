/**
 * Currency Repository
 *
 * Handles currency and exchange rate management
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';

type CurrencyRow = Database['public']['Tables']['currencies']['Row'];
type CurrencyInsert = Database['public']['Tables']['currencies']['Insert'];
type CurrencyUpdate = Database['public']['Tables']['currencies']['Update'];

type ExchangeRateRow = Database['public']['Tables']['exchange_rates']['Row'];
type ExchangeRateInsert = Database['public']['Tables']['exchange_rates']['Insert'];
type ExchangeRateUpdate = Database['public']['Tables']['exchange_rates']['Update'];

export class CurrencyRepository extends BaseRepository<'currencies'> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'currencies');
  }

  /**
   * Find currency by code
   */
  async findByCode(tenantId: string, code: string): Promise<CurrencyRow | null> {
    const { data, error } = await this.supabase
      .from('currencies')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('code', code.toUpperCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as CurrencyRow;
  }

  /**
   * Get default currency for tenant
   */
  async getDefault(tenantId: string): Promise<CurrencyRow | null> {
    const { data, error } = await this.supabase
      .from('currencies')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as CurrencyRow;
  }

  /**
   * Check if currency code exists
   */
  async codeExists(tenantId: string, code: string, excludeCurrencyId?: string): Promise<boolean> {
    let query = this.supabase
      .from('currencies')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('code', code.toUpperCase());

    if (excludeCurrencyId) {
      query = query.neq('id', excludeCurrencyId);
    }

    const { count, error } = await query;

    if (error) {
      throw error;
    }

    return (count || 0) > 0;
  }

  /**
   * Set currency as default (will unset others)
   */
  async setDefault(tenantId: string, currencyId: string): Promise<CurrencyRow | null> {
    return this.update(tenantId, currencyId, { is_default: true } as CurrencyUpdate);
  }
}

export class ExchangeRateRepository {
  private readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * Find all exchange rates
   */
  async findAll(options: QueryOptions): Promise<QueryResult<ExchangeRateRow>> {
    const {
      tenantId,
      page = 1,
      limit = 50,
      sort_by = 'effective_date',
      sort_order = 'desc',
    } = options;

    const offset = (page - 1) * limit;

    const { data, count, error } = await this.supabase
      .from('exchange_rates')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return {
      data: (data || []) as ExchangeRateRow[],
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find exchange rate by ID
   */
  async findById(tenantId: string, id: string): Promise<ExchangeRateRow | null> {
    const { data, error } = await this.supabase
      .from('exchange_rates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as ExchangeRateRow;
  }

  /**
   * Create new exchange rate
   */
  async create(
    tenantId: string,
    data: Omit<ExchangeRateInsert, 'tenant_id' | 'id'>
  ): Promise<ExchangeRateRow> {
    const { data: created, error } = await this.supabase
      .from('exchange_rates')
      .insert({
        ...data,
        tenant_id: tenantId,
      } as ExchangeRateInsert)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return created as ExchangeRateRow;
  }

  /**
   * Update exchange rate
   */
  async update(
    tenantId: string,
    id: string,
    data: Partial<ExchangeRateUpdate>
  ): Promise<ExchangeRateRow | null> {
    const { data: updated, error } = await this.supabase
      .from('exchange_rates')
      .update(data as ExchangeRateUpdate)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return updated as ExchangeRateRow;
  }

  /**
   * Delete exchange rate
   */
  async delete(tenantId: string, id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('exchange_rates')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    return true;
  }

  /**
   * Get latest exchange rate for a currency pair
   */
  async getLatestRate(
    tenantId: string,
    fromCurrency: string,
    toCurrency: string = 'USD',
    rateType: 'formal' | 'black_market' = 'formal',
    asOfDate?: string
  ): Promise<ExchangeRateRow | null> {
    let query = this.supabase
      .from('exchange_rates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('from_currency', fromCurrency.toUpperCase())
      .eq('to_currency', toCurrency.toUpperCase())
      .eq('rate_type', rateType)
      .order('effective_date', { ascending: false })
      .limit(1);

    if (asOfDate) {
      query = query.lte('effective_date', asOfDate);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as ExchangeRateRow;
  }

  /**
   * Get exchange rates for a currency pair within a date range
   */
  async getRatesInRange(
    tenantId: string,
    fromCurrency: string,
    toCurrency: string,
    rateType: 'formal' | 'black_market',
    startDate: string,
    endDate: string
  ): Promise<ExchangeRateRow[]> {
    const { data, error } = await this.supabase
      .from('exchange_rates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('from_currency', fromCurrency.toUpperCase())
      .eq('to_currency', toCurrency.toUpperCase())
      .eq('rate_type', rateType)
      .gte('effective_date', startDate)
      .lte('effective_date', endDate)
      .order('effective_date', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as ExchangeRateRow[];
  }

  /**
   * Check if rate already exists for the same date
   */
  async rateExists(
    tenantId: string,
    fromCurrency: string,
    toCurrency: string,
    rateType: 'formal' | 'black_market',
    effectiveDate: string,
    excludeRateId?: string
  ): Promise<boolean> {
    let query = this.supabase
      .from('exchange_rates')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('from_currency', fromCurrency.toUpperCase())
      .eq('to_currency', toCurrency.toUpperCase())
      .eq('rate_type', rateType)
      .eq('effective_date', effectiveDate);

    if (excludeRateId) {
      query = query.neq('id', excludeRateId);
    }

    const { count, error } = await query;

    if (error) {
      throw error;
    }

    return (count || 0) > 0;
  }
}
