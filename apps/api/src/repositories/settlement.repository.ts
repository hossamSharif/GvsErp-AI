/**
 * Settlement Repository
 *
 * Data access for inventory settlement (stock adjustment) documents.
 *
 * The settlements tables are newer than the generated Database types in
 * @erp/database, so table access is cast through `as any` in the same way
 * opening-stock.service.ts and inventory-valuation.service.ts do for
 * stock_valuation_layers. Regenerating the types will let these casts go away.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import type {
  Settlement,
  SettlementItem,
  SettlementItemWithDetails,
  SettlementWithDetails,
  SettlementStatus,
  SettlementReason,
  SettlementItemInput,
  SettlementQueryParams,
} from '@erp/shared';

interface SettlementRow {
  id: string;
  tenant_id: string;
  settlement_number: string;
  warehouse_id: string;
  settlement_date: string;
  status: SettlementStatus;
  reason: SettlementReason;
  notes: string | null;
  journal_entry_id: string | null;
  total_increase_value: number | string;
  total_decrease_value: number | string;
  reversal_of_id: string | null;
  created_by: string | null;
  posted_by: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SettlementItemRow {
  id: string;
  settlement_id: string;
  tenant_id: string;
  item_id: string;
  system_quantity: number | string;
  counted_quantity: number | string;
  difference_quantity: number | string | null;
  value_delta: number | string | null;
  unit_cost: number | string;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

interface SettlementItemJoinRow extends SettlementItemRow {
  items: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    unit_of_measure: string;
  } | null;
}

interface SettlementJoinRow extends SettlementRow {
  warehouse: { id: string; name: string } | null;
  settlement_items: SettlementItemJoinRow[];
}

export interface SettlementQueryResult {
  data: SettlementWithDetails[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

const num = (v: number | string | null | undefined): number => Number(v ?? 0);
const numOrNull = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

export class SettlementRepository {
  private readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  private get table() {
    return this.supabase.from('settlements' as any);
  }

  private get itemsTable() {
    return this.supabase.from('settlement_items' as any);
  }

  // ==========================================================================
  // MAPPERS
  // ==========================================================================

  private mapToSettlement(row: SettlementRow): Settlement {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      settlementNumber: row.settlement_number,
      warehouseId: row.warehouse_id,
      settlementDate: row.settlement_date,
      status: row.status,
      reason: row.reason,
      notes: row.notes,
      journalEntryId: row.journal_entry_id,
      totalIncreaseValue: num(row.total_increase_value),
      totalDecreaseValue: num(row.total_decrease_value),
      reversalOfId: row.reversal_of_id,
      createdBy: row.created_by,
      postedBy: row.posted_by,
      postedAt: row.posted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapToSettlementItem(row: SettlementItemRow): SettlementItem {
    return {
      id: row.id,
      settlementId: row.settlement_id,
      tenantId: row.tenant_id,
      itemId: row.item_id,
      systemQuantity: num(row.system_quantity),
      countedQuantity: num(row.counted_quantity),
      differenceQuantity: numOrNull(row.difference_quantity),
      valueDelta: numOrNull(row.value_delta),
      unitCost: num(row.unit_cost),
      notes: row.notes,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    };
  }

  private mapToDetails(row: SettlementJoinRow): SettlementWithDetails {
    const items: SettlementItemWithDetails[] = (row.settlement_items ?? [])
      .map((line) => ({
        ...this.mapToSettlementItem(line),
        itemName: line.items?.name ?? 'Unknown item',
        itemSku: line.items?.sku ?? null,
        itemBarcode: line.items?.barcode ?? null,
        unitOfMeasure: line.items?.unit_of_measure ?? 'unit',
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return {
      ...this.mapToSettlement(row),
      warehouseName: row.warehouse?.name ?? 'Unknown warehouse',
      items,
      itemCount: items.length,
    };
  }

  // ==========================================================================
  // NUMBERING
  // ==========================================================================

  /**
   * Next document number for the tenant/month. Mirrors
   * TransferRepository.generateTransferNumber; the DB also exposes
   * generate_settlement_number() for use inside SQL.
   */
  async generateSettlementNumber(tenantId: string): Promise<string> {
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');

    const { data, error } = await this.table
      .select('settlement_number')
      .eq('tenant_id', tenantId)
      .like('settlement_number', `ADJ-${yearMonth}-%`)
      .order('settlement_number', { ascending: false })
      .limit(1);

    if (error) throw error;

    let sequence = 1;
    const rows = (data ?? []) as unknown as { settlement_number: string }[];
    if (rows.length > 0) {
      const match = rows[0].settlement_number.match(/ADJ-\d{6}-(\d+)/);
      if (match) sequence = parseInt(match[1], 10) + 1;
    }

    return `ADJ-${yearMonth}-${sequence.toString().padStart(4, '0')}`;
  }

  // ==========================================================================
  // READS
  // ==========================================================================

  private static readonly DETAIL_SELECT = `
    *,
    warehouse:warehouses!settlements_warehouse_id_fkey(id, name),
    settlement_items(
      *,
      items(id, name, sku, barcode, unit_of_measure)
    )
  `;

  async findByIdWithItems(
    tenantId: string,
    id: string
  ): Promise<SettlementWithDetails | null> {
    const { data, error } = await this.table
      .select(SettlementRepository.DETAIL_SELECT)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return this.mapToDetails(data as unknown as SettlementJoinRow);
  }

  async findWithFilters(
    tenantId: string,
    params: SettlementQueryParams
  ): Promise<SettlementQueryResult> {
    const {
      status,
      warehouseId,
      reason,
      search,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortDir = 'desc',
    } = params;

    const sortColumn = (
      {
        settlementNumber: 'settlement_number',
        settlementDate: 'settlement_date',
        status: 'status',
        createdAt: 'created_at',
      } as const
    )[sortBy];

    let query = this.table
      .select(SettlementRepository.DETAIL_SELECT, { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (status) query = query.eq('status', status);
    if (warehouseId) query = query.eq('warehouse_id', warehouseId);
    if (reason) query = query.eq('reason', reason);
    if (dateFrom) query = query.gte('settlement_date', dateFrom);
    if (dateTo) query = query.lte('settlement_date', dateTo);
    if (search) {
      const escaped = search.replace(/[%_]/g, (m) => `\\${m}`);
      query = query.or(`settlement_number.ilike.%${escaped}%,notes.ilike.%${escaped}%`);
    }

    const from = (page - 1) * limit;
    query = query
      .order(sortColumn, { ascending: sortDir === 'asc' })
      .range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: ((data ?? []) as unknown as SettlementJoinRow[]).map((r) =>
        this.mapToDetails(r)
      ),
      meta: {
        page,
        limit,
        total: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / limit),
      },
    };
  }

  // ==========================================================================
  // WRITES
  // ==========================================================================

  async createWithItems(
    tenantId: string,
    header: {
      settlementNumber: string;
      warehouseId: string;
      settlementDate: string;
      reason: SettlementReason;
      notes?: string | null;
      reversalOfId?: string | null;
      createdBy?: string | null;
    },
    items: SettlementItemInput[],
    systemQuantities: Map<string, number>
  ): Promise<string> {
    const { data, error } = await this.table
      .insert({
        tenant_id: tenantId,
        settlement_number: header.settlementNumber,
        warehouse_id: header.warehouseId,
        settlement_date: header.settlementDate,
        reason: header.reason,
        notes: header.notes ?? null,
        reversal_of_id: header.reversalOfId ?? null,
        created_by: header.createdBy ?? null,
      } as any)
      .select('id')
      .single();

    if (error) throw error;
    const settlementId = (data as unknown as { id: string }).id;

    try {
      await this.replaceItems(tenantId, settlementId, items, systemQuantities);
    } catch (e) {
      // No transactions on the Supabase client — undo the header so a failed
      // line insert cannot leave an empty document behind. Same compensating
      // pattern as JournalEntryRepository.createWithLines.
      await this.table.delete().eq('id', settlementId);
      throw e;
    }

    return settlementId;
  }

  /** Replace all lines on a draft document. */
  async replaceItems(
    tenantId: string,
    settlementId: string,
    items: SettlementItemInput[],
    systemQuantities: Map<string, number>
  ): Promise<void> {
    const { error: delError } = await this.itemsTable
      .delete()
      .eq('tenant_id', tenantId)
      .eq('settlement_id', settlementId);
    if (delError) throw delError;

    const rows = items.map((item, index) => ({
      settlement_id: settlementId,
      tenant_id: tenantId,
      item_id: item.itemId,
      system_quantity: systemQuantities.get(item.itemId) ?? 0,
      counted_quantity: item.countedQuantity,
      unit_cost: item.unitCost ?? 0,
      notes: item.notes ?? null,
      sort_order: index,
    }));

    const { error } = await this.itemsTable.insert(rows as any);
    if (error) throw error;
  }

  /**
   * The settlement that reverses `settlementId`, if one exists. A targeted
   * lookup rather than scanning a page of the list — a paginated scan would
   * miss an older reversal and let the document be reversed twice.
   */
  async findReversalOf(
    tenantId: string,
    settlementId: string
  ): Promise<{ id: string; settlementNumber: string } | null> {
    const { data, error } = await this.table
      .select('id, settlement_number')
      .eq('tenant_id', tenantId)
      .eq('reversal_of_id', settlementId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as unknown as { id: string; settlement_number: string };
    return { id: row.id, settlementNumber: row.settlement_number };
  }

  async updateHeader(
    tenantId: string,
    id: string,
    patch: {
      settlementDate?: string;
      reason?: SettlementReason;
      notes?: string | null;
      journalEntryId?: string | null;
      status?: SettlementStatus;
    }
  ): Promise<void> {
    const update: Record<string, unknown> = {};
    if (patch.settlementDate !== undefined) update.settlement_date = patch.settlementDate;
    if (patch.reason !== undefined) update.reason = patch.reason;
    if (patch.notes !== undefined) update.notes = patch.notes;
    if (patch.journalEntryId !== undefined) update.journal_entry_id = patch.journalEntryId;
    if (patch.status !== undefined) update.status = patch.status;

    if (Object.keys(update).length === 0) return;

    const { error } = await this.table
      .update(update as any)
      .eq('tenant_id', tenantId)
      .eq('id', id);
    if (error) throw error;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    // settlement_items cascade on the FK.
    const { error } = await this.table.delete().eq('tenant_id', tenantId).eq('id', id);
    if (error) throw error;
  }
}
