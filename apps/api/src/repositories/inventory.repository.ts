/**
 * Inventory Repository
 *
 * Data access layer for inventory management.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { BaseRepository, QueryResult } from './base.repository';
import type {
  Inventory,
  InventoryWithDetails,
  WarehouseInventoryEntry,
  InventoryQueryParams,
  LowStockAlert,
} from '@erp-saas/shared';

type InventoryRow = Database['public']['Tables']['inventory']['Row'];
type InventoryInsert = Database['public']['Tables']['inventory']['Insert'];
type InventoryUpdate = Database['public']['Tables']['inventory']['Update'];

/**
 * Inventory repository with stock management operations
 */
export class InventoryRepository extends BaseRepository<
  'inventory',
  InventoryRow,
  InventoryInsert,
  InventoryUpdate
> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'inventory');
  }

  /**
   * Map database row to Inventory entity
   */
  private mapToInventory(row: InventoryRow): Inventory {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      itemId: row.item_id,
      warehouseId: row.warehouse_id,
      quantity: Number(row.quantity),
      reservedQuantity: Number(row.reserved_quantity) || 0,
      lowStockThreshold: row.low_stock_threshold ? Number(row.low_stock_threshold) : null,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get or create inventory record for item/warehouse
   */
  async getOrCreate(
    tenantId: string,
    itemId: string,
    warehouseId: string
  ): Promise<Inventory> {
    // Try to find existing
    const { data: existing, error: findError } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('item_id', itemId)
      .eq('warehouse_id', warehouseId)
      .single();

    if (existing) {
      return this.mapToInventory(existing);
    }

    if (findError && findError.code !== 'PGRST116') {
      throw findError;
    }

    // Create new
    const { data: created, error: createError } = await this.supabase
      .from(this.tableName)
      .insert({
        tenant_id: tenantId,
        item_id: itemId,
        warehouse_id: warehouseId,
        quantity: 0,
        reserved_quantity: 0,
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    return this.mapToInventory(created);
  }

  /**
   * Get inventory for a specific item/warehouse
   */
  async getByItemAndWarehouse(
    tenantId: string,
    itemId: string,
    warehouseId: string
  ): Promise<Inventory | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('item_id', itemId)
      .eq('warehouse_id', warehouseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return this.mapToInventory(data);
  }

  /**
   * Get inventory for a warehouse with item details
   */
  async getWarehouseInventory(
    tenantId: string,
    warehouseId: string,
    params: InventoryQueryParams = {}
  ): Promise<QueryResult<WarehouseInventoryEntry>> {
    const {
      search,
      lowStockOnly = false,
      page = 1,
      limit = 20,
      sortBy = 'itemName',
      sortDir = 'asc',
    } = params;

    const offset = (page - 1) * limit;

    // Build query with joins - item_prices is joined through items
    let query = this.supabase
      .from(this.tableName)
      .select(`
        *,
        items!inner (
          id,
          name,
          sku,
          barcode,
          unit_of_measure,
          is_active,
          item_prices (
            price,
            price_tier
          )
        )
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('warehouse_id', warehouseId)
      .eq('items.is_active', true);

    // Apply search filter
    if (search) {
      query = query.or(`items.name.ilike.%${search}%,items.sku.ilike.%${search}%,items.barcode.ilike.%${search}%`);
    }

    // Apply low stock filter
    if (lowStockOnly) {
      query = query.not('low_stock_threshold', 'is', null);
    }

    const { data, count, error } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Transform and filter results
    let entries: WarehouseInventoryEntry[] = (data || []).map((row: any) => {
      const quantity = Number(row.quantity);
      const reservedQuantity = Number(row.reserved_quantity) || 0;
      const threshold = row.low_stock_threshold ? Number(row.low_stock_threshold) : null;
      // Access item_prices through items (the correct join path)
      const costPrice = row.items?.item_prices?.find((p: any) => p.price_tier === 'cost')?.price || 0;

      return {
        id: row.id,
        itemId: row.item_id,
        itemName: row.items.name,
        itemSku: row.items.sku,
        itemBarcode: row.items.barcode,
        unitOfMeasure: row.items.unit_of_measure,
        quantity,
        reservedQuantity,
        availableQuantity: quantity - reservedQuantity,
        lowStockThreshold: threshold,
        isLowStock: threshold !== null && quantity <= threshold,
        estimatedValue: quantity * Number(costPrice),
      };
    });

    // Filter low stock if needed
    if (lowStockOnly) {
      entries = entries.filter(e => e.isLowStock);
    }

    // Sort
    entries.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'itemName':
          comparison = a.itemName.localeCompare(b.itemName);
          break;
        case 'quantity':
          comparison = a.quantity - b.quantity;
          break;
        case 'updatedAt':
        default:
          comparison = 0;
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });

    return {
      data: entries,
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Adjust inventory quantity
   */
  async adjustQuantity(
    tenantId: string,
    itemId: string,
    warehouseId: string,
    quantityChange: number,
    reservedChange: number = 0
  ): Promise<Inventory> {
    // Get or create inventory
    const inventory = await this.getOrCreate(tenantId, itemId, warehouseId);

    // Calculate new values
    const newQuantity = inventory.quantity + quantityChange;
    const newReserved = inventory.reservedQuantity + reservedChange;

    // Validate
    if (newQuantity < 0) {
      throw new Error('Insufficient inventory quantity');
    }
    if (newReserved < 0) {
      throw new Error('Invalid reserved quantity');
    }

    // Update
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        quantity: newQuantity,
        reserved_quantity: newReserved,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventory.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.mapToInventory(data);
  }

  /**
   * Reserve stock for an operation
   */
  async reserveStock(
    tenantId: string,
    itemId: string,
    warehouseId: string,
    quantity: number
  ): Promise<Inventory> {
    const inventory = await this.getOrCreate(tenantId, itemId, warehouseId);

    const available = inventory.quantity - inventory.reservedQuantity;
    if (quantity > available) {
      throw new Error(`Insufficient available stock. Available: ${available}, Requested: ${quantity}`);
    }

    return this.adjustQuantity(tenantId, itemId, warehouseId, 0, quantity);
  }

  /**
   * Release reserved stock
   */
  async releaseReserved(
    tenantId: string,
    itemId: string,
    warehouseId: string,
    quantity: number
  ): Promise<Inventory> {
    return this.adjustQuantity(tenantId, itemId, warehouseId, 0, -quantity);
  }

  /**
   * Update low stock threshold
   */
  async updateThreshold(
    tenantId: string,
    itemId: string,
    warehouseId: string,
    threshold: number | null
  ): Promise<Inventory> {
    const inventory = await this.getOrCreate(tenantId, itemId, warehouseId);

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        low_stock_threshold: threshold,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventory.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.mapToInventory(data);
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(
    tenantId: string,
    warehouseId?: string
  ): Promise<LowStockAlert[]> {
    let query = this.supabase
      .from(this.tableName)
      .select(`
        *,
        items!inner (
          id,
          name,
          sku,
          is_active
        ),
        warehouses!inner (
          id,
          name,
          is_active
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('items.is_active', true)
      .eq('warehouses.is_active', true)
      .not('low_stock_threshold', 'is', null);

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Filter and map to alerts
    return (data || [])
      .filter((row: any) => Number(row.quantity) <= Number(row.low_stock_threshold))
      .map((row: any) => {
        const quantity = Number(row.quantity);
        const threshold = Number(row.low_stock_threshold);
        return {
          itemId: row.item_id,
          itemName: row.items.name,
          itemSku: row.items.sku,
          warehouseId: row.warehouse_id,
          warehouseName: row.warehouses.name,
          quantity,
          lowStockThreshold: threshold,
          deficit: threshold - quantity,
          percentOfThreshold: threshold > 0 ? (quantity / threshold) * 100 : 0,
        };
      })
      .sort((a: LowStockAlert, b: LowStockAlert) => a.percentOfThreshold - b.percentOfThreshold);
  }

  /**
   * Get total inventory value for a warehouse
   */
  async getWarehouseValue(tenantId: string, warehouseId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(`
        quantity,
        item_id,
        items (
          item_prices (
            price,
            price_tier
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('warehouse_id', warehouseId)
      .gt('quantity', 0);

    if (error) {
      throw error;
    }

    return (data || []).reduce((total: number, row: any) => {
      const costPrice = row.items?.item_prices?.find((p: any) => p.price_tier === 'cost')?.price || 0;
      return total + Number(row.quantity) * Number(costPrice);
    }, 0);
  }

  /**
   * Get available quantity for an item across all warehouses
   */
  async getItemTotalAvailable(tenantId: string, itemId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('quantity, reserved_quantity')
      .eq('tenant_id', tenantId)
      .eq('item_id', itemId);

    if (error) {
      throw error;
    }

    return (data || []).reduce((total, row) => {
      return total + Number(row.quantity) - Number(row.reserved_quantity || 0);
    }, 0);
  }
}
