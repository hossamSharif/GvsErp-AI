/**
 * POS Service
 * Phase 7: User Story 5 - Manage Point of Sale Locations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import type {
  POSLocation,
  POSLocationWithWarehouse,
  CreatePOSLocationRequest,
  UpdatePOSLocationRequest,
  QuickSaleRequest,
  QuickSaleResponse,
  POSSaleSummary,
} from '@repo/shared';
import { POSLocationRepository } from '../repositories/pos.repository';
import { InvoiceService } from './invoice.service';
import { WarehouseRepository } from '../repositories/warehouse.repository';

export class POSService {
  private readonly supabase: SupabaseClient<Database>;
  private readonly posRepository: POSLocationRepository;
  private readonly warehouseRepository: WarehouseRepository;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
    this.posRepository = new POSLocationRepository(supabase);
    this.warehouseRepository = new WarehouseRepository(supabase);
  }

  /**
   * Get all POS locations for a tenant
   */
  async getAllLocations(tenantId: string, activeOnly = false): Promise<POSLocationWithWarehouse[]> {
    return this.posRepository.findAll(tenantId, activeOnly);
  }

  /**
   * Get a single POS location by ID
   */
  async getLocationById(id: string, tenantId: string): Promise<POSLocationWithWarehouse | null> {
    return this.posRepository.findById(id, tenantId);
  }

  /**
   * Get POS locations by warehouse ID
   */
  async getLocationsByWarehouse(warehouseId: string, tenantId: string): Promise<POSLocation[]> {
    return this.posRepository.findByWarehouse(warehouseId, tenantId);
  }

  /**
   * Create a new POS location
   */
  async createLocation(tenantId: string, data: CreatePOSLocationRequest): Promise<POSLocation> {
    // Validate that warehouse exists
    const warehouse = await this.warehouseRepository.findById(tenantId, data.warehouse_id);
    if (!warehouse) {
      throw new Error('Warehouse not found');
    }

    if (!warehouse.is_active) {
      throw new Error('Cannot create POS location for inactive warehouse');
    }

    return this.posRepository.create(tenantId, data);
  }

  /**
   * Update an existing POS location
   */
  async updateLocation(
    id: string,
    tenantId: string,
    data: UpdatePOSLocationRequest
  ): Promise<POSLocation> {
    // Check if location exists
    const existingLocation = await this.posRepository.findById(id, tenantId);
    if (!existingLocation) {
      throw new Error('POS location not found');
    }

    // Validate warehouse if being updated
    if (data.warehouse_id) {
      const warehouse = await this.warehouseRepository.findById(tenantId, data.warehouse_id);
      if (!warehouse) {
        throw new Error('Warehouse not found');
      }
      if (!warehouse.is_active) {
        throw new Error('Cannot assign POS location to inactive warehouse');
      }
    }

    return this.posRepository.update(id, tenantId, data);
  }

  /**
   * Delete a POS location (soft delete)
   */
  async deleteLocation(id: string, tenantId: string): Promise<void> {
    const location = await this.posRepository.findById(id, tenantId);
    if (!location) {
      throw new Error('POS location not found');
    }

    return this.posRepository.delete(id, tenantId);
  }

  /**
   * Process a quick sale from POS terminal
   */
  async processQuickSale(
    posLocationId: string,
    tenantId: string,
    userId: string,
    saleData: QuickSaleRequest
  ): Promise<QuickSaleResponse> {
    // Validate POS location exists and is active
    const posLocation = await this.posRepository.findById(posLocationId, tenantId);
    if (!posLocation) {
      throw new Error('POS location not found');
    }
    if (!posLocation.is_active) {
      throw new Error('POS location is inactive');
    }

    // Calculate sale summary
    const summary = this.calculateSaleSummary(saleData, posLocation.settings.tax?.default_rate);

    // Create InvoiceService with proper context
    const invoiceService = new InvoiceService(this.supabase, tenantId, userId);

    // Create invoice using the invoice service
    const invoice = await invoiceService.createInvoice({
      type: 'sale',
      warehouseId: posLocation.warehouse_id,
      partyId: saleData.party_id,
      items: saleData.items.map((item) => ({
        itemId: item.item_id,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        discountPercent: item.discount_percent || 0,
        taxRate: posLocation.settings.tax?.default_rate || 0,
      })),
      discountAmount: saleData.discount_amount,
      notes: saleData.notes || `POS Sale - ${posLocation.name}`,
    });

    // Auto-finalize the invoice (POS sales are always immediate)
    const result = await invoiceService.finalizeInvoice(invoice.id);

    return {
      invoice_id: result.invoice.id,
      invoice_number: result.invoice.invoiceNumber,
      total: summary.total,
    };
  }

  /**
   * Calculate sale summary for POS display
   */
  calculateSaleSummary(saleData: QuickSaleRequest, defaultTaxRate?: number): POSSaleSummary {
    let subtotal = 0;
    let totalDiscount = 0;
    const taxRate = defaultTaxRate || 0;

    // Calculate subtotal and item-level discounts
    for (const item of saleData.items) {
      const itemTotal = item.quantity * item.unit_price;
      subtotal += itemTotal;

      if (item.discount_percent) {
        totalDiscount += itemTotal * (item.discount_percent / 100);
      }
    }

    // Add invoice-level discount
    if (saleData.discount_amount) {
      totalDiscount += saleData.discount_amount;
    } else if (saleData.discount_percent) {
      totalDiscount += subtotal * (saleData.discount_percent / 100);
    }

    // Calculate tax on discounted amount
    const discountedSubtotal = subtotal - totalDiscount;
    const taxAmount = discountedSubtotal * (taxRate / 100);

    // Calculate total
    const total = discountedSubtotal + taxAmount;

    return {
      subtotal,
      discount_amount: totalDiscount,
      tax_amount: taxAmount,
      total,
      items_count: saleData.items.length,
    };
  }

  /**
   * Validate discount against POS location settings
   */
  validateDiscount(
    discountPercent: number,
    posLocation: POSLocation,
    isManagerApproved: boolean = false
  ): { valid: boolean; reason?: string } {
    const discountSettings = posLocation.settings.discounts;

    if (!discountSettings) {
      return { valid: true };
    }

    // Check max discount
    if (discountSettings.max_discount_percent && discountPercent > discountSettings.max_discount_percent) {
      return {
        valid: false,
        reason: `Discount exceeds maximum allowed (${discountSettings.max_discount_percent}%)`,
      };
    }

    // Check manager approval requirement
    if (
      discountSettings.require_manager_approval &&
      discountSettings.manager_approval_threshold &&
      discountPercent > discountSettings.manager_approval_threshold &&
      !isManagerApproved
    ) {
      return {
        valid: false,
        reason: `Discount above ${discountSettings.manager_approval_threshold}% requires manager approval`,
      };
    }

    return { valid: true };
  }
}
