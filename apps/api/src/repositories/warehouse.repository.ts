/**
 * Warehouse Repository
 *
 * Data access layer for warehouse management.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository, QueryResult } from './base.repository';
import type { Warehouse, WarehouseWithSummary, WarehouseQueryParams } from '@erp/shared';

type WarehouseRow = Database['public']['Tables']['warehouses']['Row'];
type WarehouseInsert = Database['public']['Tables']['warehouses']['Insert'];
type WarehouseUpdate = Database['public']['Tables']['warehouses']['Update'];

/**
 * Warehouse repository with extended operations
 */
export class WarehouseRepository extends BaseRepository<
  'warehouses',
  WarehouseRow,
  WarehouseInsert,
  WarehouseUpdate
> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'warehouses');
  }

  protected hasIsActiveColumn(): boolean {
    return true;
  }

  /**
   * Map database row to Warehouse entity
   */
  private mapToWarehouse(row: WarehouseRow): Warehouse {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      address: row.address,
      isActive: row.is_active ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Find warehouses with search and filters
   */
  async findWithFilters(
    tenantId: string,
    params: WarehouseQueryParams
  ): Promise<QueryResult<Warehouse>> {
    const {
      search,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortDir = 'asc',
    } = params;

    const offset = (page - 1) * limit;

    // Map sort field to database column
    const sortColumn = sortBy === 'createdAt' ? 'created_at'
                     : sortBy === 'updatedAt' ? 'updated_at'
                     : sortBy;

    let query = this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%`);
    }

    // Apply active filter
    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    // Apply sorting and pagination
    query = query
      .order(sortColumn, { ascending: sortDir === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data || []).map(this.mapToWarehouse),
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Get warehouse by ID with entity mapping
   */
  async getById(tenantId: string, id: string): Promise<Warehouse | null> {
    const row = await this.findById(tenantId, id);
    return row ? this.mapToWarehouse(row) : null;
  }

  /**
   * Get warehouse with inventory summary
   */
  async getWithSummary(tenantId: string, id: string): Promise<WarehouseWithSummary | null> {
    // Get warehouse
    const warehouse = await this.getById(tenantId, id);
    if (!warehouse) {
      return null;
    }

    // Get inventory summary
    const { data: summary } = await this.supabase
      .from('inventory')
      .select('quantity, item_id, low_stock_threshold')
      .eq('tenant_id', tenantId)
      .eq('warehouse_id', id);

    // Get item prices for value calculation
    const itemIds = (summary || []).map(s => s.item_id);
    const { data: prices } = await this.supabase
      .from('item_prices')
      .select('item_id, price')
      .eq('tenant_id', tenantId)
      .in('item_id', itemIds.length > 0 ? itemIds : ['none'])
      .eq('price_tier', 'cost');

    const priceMap = new Map((prices || []).map(p => [p.item_id, p.price]));

    // Calculate totals
    let totalQuantity = 0;
    let totalValue = 0;
    let lowStockCount = 0;

    for (const inv of summary || []) {
      totalQuantity += Number(inv.quantity) || 0;
      const cost = priceMap.get(inv.item_id) || 0;
      totalValue += (Number(inv.quantity) || 0) * Number(cost);

      if (inv.low_stock_threshold && Number(inv.quantity) <= Number(inv.low_stock_threshold)) {
        lowStockCount++;
      }
    }

    return {
      ...warehouse,
      totalItems: (summary || []).length,
      totalQuantity,
      totalValue,
      lowStockCount,
    };
  }

  /**
   * Create a new warehouse
   */
  async createWarehouse(
    tenantId: string,
    data: { name: string; address?: string | null; isActive?: boolean }
  ): Promise<Warehouse> {
    const row = await this.create(tenantId, {
      name: data.name,
      address: data.address || null,
      is_active: data.isActive ?? true,
    });

    return this.mapToWarehouse(row);
  }

  /**
   * Update a warehouse
   */
  async updateWarehouse(
    tenantId: string,
    id: string,
    data: { name?: string; address?: string | null; isActive?: boolean }
  ): Promise<Warehouse | null> {
    const updateData: WarehouseUpdate = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const row = await this.update(tenantId, id, updateData);
    return row ? this.mapToWarehouse(row) : null;
  }

  /**
   * Get all active warehouses (for dropdowns)
   */
  async getActiveWarehouses(tenantId: string): Promise<Warehouse[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapToWarehouse);
  }

  /**
   * Check if warehouse has inventory
   */
  async hasInventory(tenantId: string, warehouseId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('warehouse_id', warehouseId)
      .gt('quantity', 0);

    if (error) {
      throw error;
    }

    return (count || 0) > 0;
  }

  /**
   * Check if warehouse has pending transfers
   */
  async hasPendingTransfers(tenantId: string, warehouseId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('transfers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .or(`from_warehouse_id.eq.${warehouseId},to_warehouse_id.eq.${warehouseId}`)
      .in('status', ['pending', 'in_transit']);

    if (error) {
      throw error;
    }

    return (count || 0) > 0;
  }
}
