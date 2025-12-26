/**
 * Journal Entry Repository
 *
 * Manages journal entries and journal lines for double-entry accounting.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';
import type { JournalEntry, JournalLine, CreateJournalLineInput } from '@erp-saas/shared';

type JournalEntryRow = Database['public']['Tables']['journal_entries']['Row'];
type JournalEntryInsert = Database['public']['Tables']['journal_entries']['Insert'];
type JournalEntryUpdate = Database['public']['Tables']['journal_entries']['Update'];
type JournalLineRow = Database['public']['Tables']['journal_lines']['Row'];
type JournalLineInsert = Database['public']['Tables']['journal_lines']['Insert'];

export interface JournalEntryQueryOptions extends QueryOptions {
  start_date?: string;
  end_date?: string;
  is_posted?: boolean;
  source_type?: string;
  account_id?: string;
}

export class JournalEntryRepository extends BaseRepository<
  'journal_entries',
  JournalEntryRow,
  JournalEntryInsert,
  JournalEntryUpdate
> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'journal_entries');
  }

  /**
   * Find all journal entries with optional filters
   */
  async findAll(options: JournalEntryQueryOptions): Promise<QueryResult<JournalEntry>> {
    const {
      tenantId,
      page = 1,
      limit = 50,
      sort_by = 'entry_date',
      sort_order = 'desc',
      start_date,
      end_date,
      is_posted,
      source_type,
      account_id,
    } = options;

    const offset = (page - 1) * limit;

    // Build base query
    let query = this.supabase
      .from(this.tableName)
      .select('*, journal_lines(*)', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (start_date) {
      query = query.gte('entry_date', start_date);
    }

    if (end_date) {
      query = query.lte('entry_date', end_date);
    }

    if (is_posted !== undefined) {
      query = query.eq('is_posted', is_posted);
    }

    if (source_type) {
      query = query.eq('source_type', source_type);
    }

    // Filter by account if specified
    if (account_id) {
      // Get journal entry IDs that have lines for this account
      const { data: lineData } = await this.supabase
        .from('journal_lines')
        .select('journal_entry_id')
        .eq('tenant_id', tenantId)
        .eq('account_id', account_id);

      if (lineData && lineData.length > 0) {
        const entryIds = lineData.map((line) => line.journal_entry_id);
        query = query.in('id', entryIds);
      } else {
        // No entries found for this account
        return {
          data: [],
          meta: {
            page,
            limit,
            total: 0,
            total_pages: 0,
          },
        };
      }
    }

    // Apply sorting and pagination
    query = query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data || []) as JournalEntry[],
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find journal entry by ID with lines
   */
  async findById(tenantId: string, id: string): Promise<JournalEntry | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*, journal_lines(*)')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as JournalEntry;
  }

  /**
   * Find journal entry by entry number
   */
  async findByEntryNumber(tenantId: string, entryNumber: string): Promise<JournalEntry | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*, journal_lines(*)')
      .eq('tenant_id', tenantId)
      .eq('entry_number', entryNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as JournalEntry;
  }

  /**
   * Create journal entry with lines
   */
  async createWithLines(
    tenantId: string,
    userId: string,
    entryData: {
      entry_date: string;
      description?: string;
      source_type?: string;
      source_id?: string;
    },
    lines: CreateJournalLineInput[]
  ): Promise<JournalEntry> {
    // Start transaction
    // Note: Supabase doesn't support transactions in the client library,
    // so we'll use sequential operations and handle errors

    // Create journal entry
    const { data: entry, error: entryError } = await this.supabase
      .from(this.tableName)
      .insert({
        tenant_id: tenantId,
        created_by: userId,
        is_posted: false,
        ...entryData,
      } as JournalEntryInsert)
      .select()
      .single();

    if (entryError) {
      throw entryError;
    }

    // Create journal lines
    const journalLines = lines.map((line) => ({
      tenant_id: tenantId,
      journal_entry_id: entry.id,
      account_id: line.account_id,
      debit: line.debit || 0,
      credit: line.credit || 0,
      description: line.description,
    }));

    const { error: linesError } = await this.supabase
      .from('journal_lines')
      .insert(journalLines as JournalLineInsert[]);

    if (linesError) {
      // Rollback: delete the entry
      await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', entry.id);
      throw linesError;
    }

    // Fetch the complete entry with lines
    return this.findById(tenantId, entry.id) as Promise<JournalEntry>;
  }

  /**
   * Update journal entry (only if not posted)
   */
  async updateWithLines(
    tenantId: string,
    id: string,
    entryData: {
      entry_date?: string;
      description?: string;
    },
    lines?: CreateJournalLineInput[]
  ): Promise<JournalEntry | null> {
    // Check if entry exists and is not posted
    const existing = await this.findById(tenantId, id);
    if (!existing) return null;
    if (existing.is_posted) {
      throw new Error('Cannot update posted journal entry');
    }

    // Update entry
    if (Object.keys(entryData).length > 0) {
      const { error: entryError } = await this.supabase
        .from(this.tableName)
        .update(entryData as JournalEntryUpdate)
        .eq('tenant_id', tenantId)
        .eq('id', id);

      if (entryError) {
        throw entryError;
      }
    }

    // Update lines if provided
    if (lines) {
      // Delete existing lines
      const { error: deleteError } = await this.supabase
        .from('journal_lines')
        .delete()
        .eq('journal_entry_id', id);

      if (deleteError) {
        throw deleteError;
      }

      // Insert new lines
      const journalLines = lines.map((line) => ({
        tenant_id: tenantId,
        journal_entry_id: id,
        account_id: line.account_id,
        debit: line.debit || 0,
        credit: line.credit || 0,
        description: line.description,
      }));

      const { error: insertError } = await this.supabase
        .from('journal_lines')
        .insert(journalLines as JournalLineInsert[]);

      if (insertError) {
        throw insertError;
      }
    }

    return this.findById(tenantId, id);
  }

  /**
   * Post journal entry (finalize)
   */
  async post(tenantId: string, id: string): Promise<JournalEntry | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({ is_posted: true } as JournalEntryUpdate)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select('*, journal_lines(*)')
      .single();

    if (error) {
      throw error;
    }

    return data as JournalEntry;
  }

  /**
   * Get journal lines for an account within a date range
   */
  async getAccountLines(
    tenantId: string,
    accountId: string,
    startDate?: string,
    endDate?: string
  ): Promise<JournalLine[]> {
    let query = this.supabase
      .from('journal_lines')
      .select('*, journal_entries!inner(*)')
      .eq('tenant_id', tenantId)
      .eq('account_id', accountId)
      .eq('journal_entries.is_posted', true);

    if (startDate) {
      query = query.gte('journal_entries.entry_date', startDate);
    }

    if (endDate) {
      query = query.lte('journal_entries.entry_date', endDate);
    }

    query = query.order('journal_entries(entry_date)', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data || []) as JournalLine[];
  }

  /**
   * Delete journal entry (only if not posted)
   */
  async delete(tenantId: string, id: string): Promise<boolean> {
    // Check if entry is posted
    const entry = await this.findById(tenantId, id);
    if (!entry) return false;
    if (entry.is_posted) {
      throw new Error('Cannot delete posted journal entry');
    }

    // Delete lines first (cascade should handle this, but being explicit)
    await this.supabase
      .from('journal_lines')
      .delete()
      .eq('journal_entry_id', id);

    // Delete entry
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    return true;
  }
}
