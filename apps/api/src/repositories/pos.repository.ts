/**
 * POS Location Repository
 * Phase 7: User Story 5 - Manage Point of Sale Locations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import type {
  POSLocation,
  POSLocationWithWarehouse,
  CreatePOSLocationRequest,
  UpdatePOSLocationRequest,
} from '@erp/shared';

export class POSLocationRepository {
  protected readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }
  /**
   * Get all POS locations for a tenant
   */
  async findAll(tenantId: string, activeOnly = false): Promise<POSLocationWithWarehouse[]> {
    let query = this.supabase
      .from('pos_locations')
      .select(`
        *,
        warehouse:warehouses (
          id,
          name
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch POS locations: ${error.message}`);
    }

    return data as POSLocationWithWarehouse[];
  }

  /**
   * Get a single POS location by ID
   */
  async findById(id: string, tenantId: string): Promise<POSLocationWithWarehouse | null> {
    const { data, error } = await this.supabase
      .from('pos_locations')
      .select(`
        *,
        warehouse:warehouses (
          id,
          name
        )
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch POS location: ${error.message}`);
    }

    return data as POSLocationWithWarehouse;
  }

  /**
   * Get POS locations by warehouse ID
   */
  async findByWarehouse(warehouseId: string, tenantId: string): Promise<POSLocation[]> {
    const { data, error } = await this.supabase
      .from('pos_locations')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch POS locations by warehouse: ${error.message}`);
    }

    return data as POSLocation[];
  }

  /**
   * Create a new POS location
   */
  async create(tenantId: string, data: CreatePOSLocationRequest): Promise<POSLocation> {
    const { data: newLocation, error } = await this.supabase
      .from('pos_locations')
      .insert({
        tenant_id: tenantId,
        name: data.name,
        warehouse_id: data.warehouse_id,
        settings: (data.settings || {}) as any,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create POS location: ${error.message}`);
    }

    return newLocation as POSLocation;
  }

  /**
   * Update an existing POS location
   */
  async update(
    id: string,
    tenantId: string,
    data: UpdatePOSLocationRequest
  ): Promise<POSLocation> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.warehouse_id !== undefined) updateData.warehouse_id = data.warehouse_id;
    if (data.settings !== undefined) updateData.settings = data.settings;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const { data: updatedLocation, error } = await this.supabase
      .from('pos_locations')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update POS location: ${error.message}`);
    }

    return updatedLocation as POSLocation;
  }

  /**
   * Delete a POS location (soft delete)
   */
  async delete(id: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('pos_locations')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to delete POS location: ${error.message}`);
    }
  }

  /**
   * Hard delete a POS location (permanent)
   */
  async hardDelete(id: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('pos_locations')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to permanently delete POS location: ${error.message}`);
    }
  }

  /**
   * Check if a POS location exists and is active
   */
  async existsAndActive(id: string, tenantId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('pos_locations')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check POS location existence: ${error.message}`);
    }

    return !!data;
  }
}
