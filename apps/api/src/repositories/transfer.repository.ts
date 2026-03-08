/**
 * Transfer Repository
 *
 * Data access layer for stock transfer management.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository, QueryResult } from './base.repository';
import type {
  Transfer,
  TransferWithDetails,
  TransferItem,
  TransferItemWithDetails,
  TransferStatus,
  TransferQueryParams,
  CreateTransferItemInput,
} from '@erp/shared';

type TransferRow = Database['public']['Tables']['transfers']['Row'];
type TransferInsert = Database['public']['Tables']['transfers']['Insert'];
type TransferUpdate = Database['public']['Tables']['transfers']['Update'];
type TransferItemRow = Database['public']['Tables']['transfer_items']['Row'];
type TransferItemInsert = Database['public']['Tables']['transfer_items']['Insert'];

/**
 * Transfer repository with stock movement operations
 */
export class TransferRepository extends BaseRepository<
  'transfers',
  TransferRow,
  TransferInsert,
  TransferUpdate
> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'transfers');
  }

  /**
   * Map database row to Transfer entity
   */
  private mapToTransfer(row: TransferRow): Transfer {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      transferNumber: row.transfer_number,
      fromWarehouseId: row.from_warehouse_id,
      toWarehouseId: row.to_warehouse_id,
      status: row.status as TransferStatus,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }

  /**
   * Map database row to TransferItem entity
   */
  private mapToTransferItem(row: TransferItemRow): TransferItem {
    return {
      id: row.id,
      transferId: row.transfer_id,
      tenantId: row.tenant_id,
      itemId: row.item_id,
      quantity: Number(row.quantity),
      createdAt: row.created_at,
    };
  }

  /**
   * Generate unique transfer number
   */
  async generateTransferNumber(tenantId: string): Promise<string> {
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');

    // Get the highest sequence number for this tenant and month
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('transfer_number')
      .eq('tenant_id', tenantId)
      .like('transfer_number', `TRF-${yearMonth}-%`)
      .order('transfer_number', { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    let sequence = 1;
    if (data && data.length > 0) {
      const match = data[0].transfer_number.match(/TRF-\d{6}-(\d+)/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    return `TRF-${yearMonth}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Find transfers with filters
   */
  async findWithFilters(
    tenantId: string,
    params: TransferQueryParams
  ): Promise<QueryResult<TransferWithDetails>> {
    const {
      status,
      fromWarehouseId,
      toWarehouseId,
      search,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortDir = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    // Map sort field to database column
    const sortColumn = sortBy === 'createdAt' ? 'created_at'
                     : sortBy === 'completedAt' ? 'completed_at'
                     : sortBy === 'transferNumber' ? 'transfer_number'
                     : sortBy;

    let query = this.supabase
      .from(this.tableName)
      .select(`
        *,
        from_warehouse:warehouses!transfers_from_warehouse_id_fkey (
          id,
          name
        ),
        to_warehouse:warehouses!transfers_to_warehouse_id_fkey (
          id,
          name
        ),
        transfer_items (
          *,
          items (
            id,
            name,
            sku,
            barcode,
            unit_of_measure
          )
        )
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (fromWarehouseId) {
      query = query.eq('from_warehouse_id', fromWarehouseId);
    }
    if (toWarehouseId) {
      query = query.eq('to_warehouse_id', toWarehouseId);
    }
    if (search) {
      query = query.ilike('transfer_number', `%${BaseRepository.escapeILike(search)}%`);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59.999Z`);
    }

    // Apply sorting and pagination
    query = query
      .order(sortColumn, { ascending: sortDir === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    const transfers: TransferWithDetails[] = (data || []).map((row: any) => {
      const items: TransferItemWithDetails[] = (row.transfer_items || []).map((ti: any) => ({
        id: ti.id,
        transferId: ti.transfer_id,
        tenantId: ti.tenant_id,
        itemId: ti.item_id,
        quantity: Number(ti.quantity),
        createdAt: ti.created_at,
        item: {
          id: ti.items.id,
          name: ti.items.name,
          sku: ti.items.sku,
          barcode: ti.items.barcode,
          unitOfMeasure: ti.items.unit_of_measure,
        },
        sourceAvailable: 0, // Will be populated if needed
      }));

      return {
        id: row.id,
        tenantId: row.tenant_id,
        transferNumber: row.transfer_number,
        fromWarehouseId: row.from_warehouse_id,
        toWarehouseId: row.to_warehouse_id,
        status: row.status as TransferStatus,
        notes: row.notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
        fromWarehouse: {
          id: row.from_warehouse.id,
          name: row.from_warehouse.name,
        },
        toWarehouse: {
          id: row.to_warehouse.id,
          name: row.to_warehouse.name,
        },
        items,
        totalItems: items.length,
        totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
      };
    });

    return {
      data: transfers,
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Get transfer by ID with details
   */
  async getByIdWithDetails(tenantId: string, id: string): Promise<TransferWithDetails | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(`
        *,
        from_warehouse:warehouses!transfers_from_warehouse_id_fkey (
          id,
          name
        ),
        to_warehouse:warehouses!transfers_to_warehouse_id_fkey (
          id,
          name
        ),
        transfer_items (
          *,
          items (
            id,
            name,
            sku,
            barcode,
            unit_of_measure
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    const items: TransferItemWithDetails[] = (data.transfer_items || []).map((ti: any) => ({
      id: ti.id,
      transferId: ti.transfer_id,
      tenantId: ti.tenant_id,
      itemId: ti.item_id,
      quantity: Number(ti.quantity),
      createdAt: ti.created_at,
      item: {
        id: ti.items.id,
        name: ti.items.name,
        sku: ti.items.sku,
        barcode: ti.items.barcode,
        unitOfMeasure: ti.items.unit_of_measure,
      },
      sourceAvailable: 0,
    }));

    return {
      id: data.id,
      tenantId: data.tenant_id,
      transferNumber: data.transfer_number,
      fromWarehouseId: data.from_warehouse_id,
      toWarehouseId: data.to_warehouse_id,
      status: data.status as TransferStatus,
      notes: data.notes,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      completedAt: data.completed_at,
      fromWarehouse: {
        id: data.from_warehouse.id,
        name: data.from_warehouse.name,
      },
      toWarehouse: {
        id: data.to_warehouse.id,
        name: data.to_warehouse.name,
      },
      items,
      totalItems: items.length,
      totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
    };
  }

  /**
   * Create a new transfer with items
   */
  async createTransfer(
    tenantId: string,
    data: {
      fromWarehouseId: string;
      toWarehouseId: string;
      notes?: string | null;
      createdBy?: string | null;
    },
    items: CreateTransferItemInput[]
  ): Promise<TransferWithDetails> {
    // Generate transfer number
    const transferNumber = await this.generateTransferNumber(tenantId);

    // Create transfer
    const { data: transfer, error: transferError } = await this.supabase
      .from(this.tableName)
      .insert({
        tenant_id: tenantId,
        transfer_number: transferNumber,
        from_warehouse_id: data.fromWarehouseId,
        to_warehouse_id: data.toWarehouseId,
        status: 'pending',
        notes: data.notes || null,
        created_by: data.createdBy || null,
      })
      .select()
      .single();

    if (transferError) {
      throw transferError;
    }

    // Create transfer items
    const transferItems: TransferItemInsert[] = items.map(item => ({
      transfer_id: transfer.id,
      tenant_id: tenantId,
      item_id: item.itemId,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await this.supabase
      .from('transfer_items')
      .insert(transferItems);

    if (itemsError) {
      // Rollback transfer
      await this.supabase.from(this.tableName).delete().eq('id', transfer.id);
      throw itemsError;
    }

    // Return with details
    return this.getByIdWithDetails(tenantId, transfer.id) as Promise<TransferWithDetails>;
  }

  /**
   * Update transfer status
   */
  async updateStatus(
    tenantId: string,
    id: string,
    status: TransferStatus,
    completedAt?: string
  ): Promise<Transfer | null> {
    const update: TransferUpdate = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (completedAt) {
      update.completed_at = completedAt;
    }

    const row = await this.update(tenantId, id, update);
    return row ? this.mapToTransfer(row) : null;
  }

  /**
   * Update transfer notes
   */
  async updateNotes(tenantId: string, id: string, notes: string | null): Promise<Transfer | null> {
    const row = await this.update(tenantId, id, { notes });
    return row ? this.mapToTransfer(row) : null;
  }

  /**
   * Get transfer items
   */
  async getTransferItems(tenantId: string, transferId: string): Promise<TransferItem[]> {
    const { data, error } = await this.supabase
      .from('transfer_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('transfer_id', transferId);

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapToTransferItem);
  }

  /**
   * Delete transfer items (for pending transfers only)
   */
  async deleteTransferItems(tenantId: string, transferId: string): Promise<void> {
    const { error } = await this.supabase
      .from('transfer_items')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('transfer_id', transferId);

    if (error) {
      throw error;
    }
  }

  /**
   * Add items to transfer
   */
  async addTransferItems(
    tenantId: string,
    transferId: string,
    items: CreateTransferItemInput[]
  ): Promise<void> {
    const transferItems: TransferItemInsert[] = items.map(item => ({
      transfer_id: transferId,
      tenant_id: tenantId,
      item_id: item.itemId,
      quantity: item.quantity,
    }));

    const { error } = await this.supabase
      .from('transfer_items')
      .insert(transferItems);

    if (error) {
      throw error;
    }
  }

  /**
   * Get transfers for a warehouse (either source or destination)
   */
  async getWarehouseTransfers(
    tenantId: string,
    warehouseId: string,
    status?: TransferStatus
  ): Promise<Transfer[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .or(`from_warehouse_id.eq.${warehouseId},to_warehouse_id.eq.${warehouseId}`);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapToTransfer);
  }
}
