/**
 * Journal Entry Repository
 *
 * Manages journal entries and journal lines for double-entry accounting.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';
import type { JournalEntry, JournalLine, CreateJournalLineInput } from '@erp/shared';

type JournalEntryRow = Database['public']['Tables']['journal_entries']['Row'];
type JournalEntryInsert = Database['public']['Tables']['journal_entries']['Insert'];
type JournalEntryUpdate = Database['public']['Tables']['journal_entries']['Update'];
type JournalLineRow = Database['public']['Tables']['journal_lines']['Row'];
type JournalLineInsert = Database['public']['Tables']['journal_lines']['Insert'];

type JournalEntryWithLines = JournalEntryRow & {
  journal_lines: JournalLineRow[];
};

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
   * Map DB row (with joined journal_lines) to JournalEntry type
   */
  private mapEntry(row: JournalEntryWithLines): JournalEntry {
    // Phase 2: voucher_type + narration columns are added by migration 027
    // and may not appear in the generated Database types yet.
    const extraCols = row as unknown as {
      voucher_type?: string | null;
      narration?: string | null;
    };
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      entry_number: row.entry_number,
      entry_date: row.entry_date,
      description: row.description ?? undefined,
      source_type: row.source_type ?? undefined,
      source_id: row.source_id ?? undefined,
      voucher_type:
        (extraCols.voucher_type as JournalEntry['voucher_type']) ?? undefined,
      narration: extraCols.narration ?? undefined,
      is_posted: row.is_posted ?? false,
      created_by: row.created_by ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      lines: (row.journal_lines || []).map((line) => ({
        id: line.id,
        journal_entry_id: line.journal_entry_id,
        tenant_id: line.tenant_id,
        account_id: line.account_id,
        debit: Number(line.debit ?? 0),
        credit: Number(line.credit ?? 0),
        description: line.description ?? undefined,
        created_at: line.created_at,
      })),
    };
  }

  /**
   * Find all journal entries with optional filters
   */
  async findAllEntries(options: JournalEntryQueryOptions): Promise<QueryResult<JournalEntry>> {
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
      data: (data || []).map((row) => this.mapEntry(row as JournalEntryWithLines)),
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
  async findEntryById(tenantId: string, id: string): Promise<JournalEntry | null> {
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

    return this.mapEntry(data);
  }

  /**
   * Find the (single) journal entry that originated from a specific source
   * transaction, e.g. (sourceType='sale', sourceId=<invoice_id>). Returns
   * the latest by date if multiple exist (only possible across drafts +
   * reversals; the partial unique index in migration 021 forbids two posted
   * rows with the same source).
   */
  async findBySource(
    tenantId: string,
    sourceType: string,
    sourceId: string
  ): Promise<JournalEntry | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*, journal_lines(*)')
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data ? this.mapEntry(data as JournalEntryWithLines) : null;
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

    return this.mapEntry(data);
  }

  /**
   * Create journal entry with lines
   *
   * Note: entry_number is auto-generated by the DB trigger
   * `generate_journal_entry_number()` (migration 011) before insert, so we
   * deliberately omit it. The generated database.types.ts types entry_number
   * as required, hence the unknown cast.
   */
  async createWithLines(
    tenantId: string,
    userId: string | null,
    entryData: {
      entry_date: string;
      description?: string;
      source_type?: string;
      source_id?: string;
      /** Phase 2: Tally voucher type. */
      voucher_type?: string;
      /** Phase 2: free-text narration. */
      narration?: string;
    },
    lines: CreateJournalLineInput[]
  ): Promise<JournalEntry> {
    // Create journal entry. Supabase JS doesn't expose transactions, so
    // failure to insert lines triggers a manual rollback of the parent row.
    const { data: entry, error: entryError } = await this.supabase
      .from(this.tableName)
      .insert({
        tenant_id: tenantId,
        entry_date: entryData.entry_date,
        description: entryData.description ?? null,
        source_type: entryData.source_type ?? null,
        source_id: entryData.source_id ?? null,
        voucher_type: entryData.voucher_type ?? null,
        narration: entryData.narration ?? null,
        created_by: userId,
      } as unknown as JournalEntryInsert)
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
    return this.findEntryById(tenantId, entry.id) as Promise<JournalEntry>;
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
    const existing = await this.findEntryById(tenantId, id);
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

    return this.findEntryById(tenantId, id);
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

    return this.mapEntry(data);
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
    // PostgREST is fussy about cross-table predicates on embedded resources.
    // Two-step query is cheaper to maintain than the embedded version and
    // sidesteps the "not an embedded resource" / "failed to parse order"
    // failures we hit when ordering on journal_entries.entry_date.
    let entryQuery = this.supabase
      .from(this.tableName)
      .select('id, entry_date')
      .eq('tenant_id', tenantId)
      .eq('is_posted', true);
    if (startDate) entryQuery = entryQuery.gte('entry_date', startDate);
    if (endDate)   entryQuery = entryQuery.lte('entry_date', endDate);
    const { data: entries, error: eErr } = await entryQuery;
    if (eErr) throw eErr;
    if (!entries || entries.length === 0) return [];

    const entryIds = entries.map((e) => e.id);
    const dateById = new Map(entries.map((e) => [e.id, e.entry_date]));

    const { data: lines, error: lErr } = await this.supabase
      .from('journal_lines')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('account_id', accountId)
      .in('journal_entry_id', entryIds);
    if (lErr) throw lErr;

    return (lines ?? [])
      .map((l) => ({ ...l, entry_date: dateById.get(l.journal_entry_id) }))
      .sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date))) as unknown as JournalLine[];
  }

  /**
   * Delete journal entry (only if not posted)
   */
  async delete(tenantId: string, id: string): Promise<boolean> {
    // Check if entry is posted
    const entry = await this.findEntryById(tenantId, id);
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
