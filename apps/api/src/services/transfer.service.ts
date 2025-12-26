/**
 * Transfer Service
 *
 * Business logic for stock transfers between warehouses.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { TransferRepository } from '../repositories/transfer.repository';
import { InventoryRepository } from '../repositories/inventory.repository';
import { WarehouseRepository } from '../repositories/warehouse.repository';
import type {
  Transfer,
  TransferWithDetails,
  TransferStatus,
  TransferQueryParams,
  CreateTransferInput,
  UpdateTransferInput,
} from '@erp-saas/shared';
import { QueryResult } from '../repositories/base.repository';

/**
 * Custom error class for transfer-related errors
 */
export class TransferError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'TransferError';
  }
}

/**
 * Transfer service with stock movement logic
 */
export class TransferService {
  private readonly transferRepo: TransferRepository;
  private readonly inventoryRepo: InventoryRepository;
  private readonly warehouseRepo: WarehouseRepository;
  private readonly tenantId: string;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.transferRepo = new TransferRepository(supabase);
    this.inventoryRepo = new InventoryRepository(supabase);
    this.warehouseRepo = new WarehouseRepository(supabase);
    this.tenantId = tenantId;
  }

  // =============================================================================
  // TRANSFER CRUD OPERATIONS
  // =============================================================================

  /**
   * Get transfers with pagination and filters
   */
  async getTransfers(params: TransferQueryParams = {}): Promise<QueryResult<TransferWithDetails>> {
    return this.transferRepo.findWithFilters(this.tenantId, params);
  }

  /**
   * Get a single transfer by ID
   */
  async getTransfer(id: string): Promise<TransferWithDetails> {
    const transfer = await this.transferRepo.getByIdWithDetails(this.tenantId, id);
    if (!transfer) {
      throw new TransferError('Transfer not found', 'TRANSFER_NOT_FOUND', 404);
    }
    return transfer;
  }

  /**
   * Create a new transfer
   */
  async createTransfer(input: CreateTransferInput, createdBy?: string): Promise<TransferWithDetails> {
    // Validate warehouses exist and are active
    const fromWarehouse = await this.warehouseRepo.getById(this.tenantId, input.fromWarehouseId);
    if (!fromWarehouse) {
      throw new TransferError('Source warehouse not found', 'SOURCE_WAREHOUSE_NOT_FOUND', 404);
    }
    if (!fromWarehouse.isActive) {
      throw new TransferError('Source warehouse is not active', 'SOURCE_WAREHOUSE_INACTIVE', 400);
    }

    const toWarehouse = await this.warehouseRepo.getById(this.tenantId, input.toWarehouseId);
    if (!toWarehouse) {
      throw new TransferError('Destination warehouse not found', 'DEST_WAREHOUSE_NOT_FOUND', 404);
    }
    if (!toWarehouse.isActive) {
      throw new TransferError('Destination warehouse is not active', 'DEST_WAREHOUSE_INACTIVE', 400);
    }

    // Validate all items have sufficient inventory
    const insufficientItems: string[] = [];
    for (const item of input.items) {
      const inventory = await this.inventoryRepo.getByItemAndWarehouse(
        this.tenantId,
        item.itemId,
        input.fromWarehouseId
      );

      const available = inventory
        ? inventory.quantity - inventory.reservedQuantity
        : 0;

      if (available < item.quantity) {
        insufficientItems.push(item.itemId);
      }
    }

    if (insufficientItems.length > 0) {
      throw new TransferError(
        `Insufficient inventory for ${insufficientItems.length} item(s)`,
        'INSUFFICIENT_INVENTORY',
        400
      );
    }

    // Create transfer
    const transfer = await this.transferRepo.createTransfer(
      this.tenantId,
      {
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        notes: input.notes,
        createdBy,
      },
      input.items
    );

    return transfer;
  }

  /**
   * Update a transfer (only pending transfers)
   */
  async updateTransfer(id: string, input: UpdateTransferInput): Promise<TransferWithDetails> {
    const transfer = await this.getTransfer(id);

    if (transfer.status !== 'pending') {
      throw new TransferError(
        'Only pending transfers can be updated',
        'TRANSFER_NOT_PENDING',
        400
      );
    }

    // Update notes if provided
    if (input.notes !== undefined) {
      await this.transferRepo.updateNotes(this.tenantId, id, input.notes);
    }

    // Update items if provided
    if (input.items) {
      // Validate new items have sufficient inventory
      const insufficientItems: string[] = [];
      for (const item of input.items) {
        const inventory = await this.inventoryRepo.getByItemAndWarehouse(
          this.tenantId,
          item.itemId,
          transfer.fromWarehouseId
        );

        const available = inventory
          ? inventory.quantity - inventory.reservedQuantity
          : 0;

        if (available < item.quantity) {
          insufficientItems.push(item.itemId);
        }
      }

      if (insufficientItems.length > 0) {
        throw new TransferError(
          `Insufficient inventory for ${insufficientItems.length} item(s)`,
          'INSUFFICIENT_INVENTORY',
          400
        );
      }

      // Delete existing items and add new ones
      await this.transferRepo.deleteTransferItems(this.tenantId, id);
      await this.transferRepo.addTransferItems(this.tenantId, id, input.items);
    }

    return this.getTransfer(id);
  }

  // =============================================================================
  // TRANSFER STATE TRANSITIONS
  // =============================================================================

  /**
   * Start transfer (pending -> in_transit)
   * Reserves stock at source warehouse
   */
  async startTransfer(id: string): Promise<TransferWithDetails> {
    const transfer = await this.getTransfer(id);

    if (transfer.status !== 'pending') {
      throw new TransferError(
        'Only pending transfers can be started',
        'TRANSFER_NOT_PENDING',
        400
      );
    }

    // Reserve stock at source warehouse
    for (const item of transfer.items) {
      try {
        await this.inventoryRepo.reserveStock(
          this.tenantId,
          item.itemId,
          transfer.fromWarehouseId,
          item.quantity
        );
      } catch (error) {
        // If we fail to reserve any item, release all previously reserved
        const index = transfer.items.indexOf(item);
        for (let i = 0; i < index; i++) {
          await this.inventoryRepo.releaseReserved(
            this.tenantId,
            transfer.items[i].itemId,
            transfer.fromWarehouseId,
            transfer.items[i].quantity
          );
        }
        throw new TransferError(
          `Failed to reserve stock for item: ${item.item.name}`,
          'RESERVE_FAILED',
          400
        );
      }
    }

    // Update status
    await this.transferRepo.updateStatus(this.tenantId, id, 'in_transit');

    return this.getTransfer(id);
  }

  /**
   * Complete transfer (in_transit -> completed)
   * Moves stock from source to destination
   */
  async completeTransfer(id: string): Promise<TransferWithDetails> {
    const transfer = await this.getTransfer(id);

    if (transfer.status !== 'in_transit') {
      throw new TransferError(
        'Only in-transit transfers can be completed',
        'TRANSFER_NOT_IN_TRANSIT',
        400
      );
    }

    // Move stock for each item
    for (const item of transfer.items) {
      // Release reserved and decrease quantity at source
      await this.inventoryRepo.adjustQuantity(
        this.tenantId,
        item.itemId,
        transfer.fromWarehouseId,
        -item.quantity, // Decrease quantity
        -item.quantity  // Release reserved
      );

      // Increase quantity at destination
      await this.inventoryRepo.adjustQuantity(
        this.tenantId,
        item.itemId,
        transfer.toWarehouseId,
        item.quantity, // Increase quantity
        0
      );
    }

    // Update status
    await this.transferRepo.updateStatus(
      this.tenantId,
      id,
      'completed',
      new Date().toISOString()
    );

    return this.getTransfer(id);
  }

  /**
   * Cancel transfer (pending or in_transit -> canceled)
   * Releases any reserved stock
   */
  async cancelTransfer(id: string): Promise<TransferWithDetails> {
    const transfer = await this.getTransfer(id);

    if (transfer.status === 'completed') {
      throw new TransferError(
        'Completed transfers cannot be canceled',
        'TRANSFER_COMPLETED',
        400
      );
    }

    if (transfer.status === 'canceled') {
      throw new TransferError(
        'Transfer is already canceled',
        'TRANSFER_ALREADY_CANCELED',
        400
      );
    }

    // Release reserved stock if transfer was in_transit
    if (transfer.status === 'in_transit') {
      for (const item of transfer.items) {
        await this.inventoryRepo.releaseReserved(
          this.tenantId,
          item.itemId,
          transfer.fromWarehouseId,
          item.quantity
        );
      }
    }

    // Update status
    await this.transferRepo.updateStatus(this.tenantId, id, 'canceled');

    return this.getTransfer(id);
  }

  // =============================================================================
  // CONVENIENCE METHODS
  // =============================================================================

  /**
   * Quick complete - start and complete in one step
   * For immediate transfers without transit period
   */
  async quickComplete(id: string): Promise<TransferWithDetails> {
    const transfer = await this.getTransfer(id);

    if (transfer.status !== 'pending') {
      throw new TransferError(
        'Only pending transfers can be quick-completed',
        'TRANSFER_NOT_PENDING',
        400
      );
    }

    // Move stock directly without reserving
    for (const item of transfer.items) {
      // Decrease at source
      await this.inventoryRepo.adjustQuantity(
        this.tenantId,
        item.itemId,
        transfer.fromWarehouseId,
        -item.quantity,
        0
      );

      // Increase at destination
      await this.inventoryRepo.adjustQuantity(
        this.tenantId,
        item.itemId,
        transfer.toWarehouseId,
        item.quantity,
        0
      );
    }

    // Update status directly to completed
    await this.transferRepo.updateStatus(
      this.tenantId,
      id,
      'completed',
      new Date().toISOString()
    );

    return this.getTransfer(id);
  }

  /**
   * Get pending transfers for a warehouse
   */
  async getPendingTransfers(warehouseId: string): Promise<Transfer[]> {
    return this.transferRepo.getWarehouseTransfers(this.tenantId, warehouseId, 'pending');
  }

  /**
   * Get in-transit transfers for a warehouse
   */
  async getInTransitTransfers(warehouseId: string): Promise<Transfer[]> {
    return this.transferRepo.getWarehouseTransfers(this.tenantId, warehouseId, 'in_transit');
  }

  /**
   * Get available quantity with pending transfers considered
   */
  async getAvailableWithPending(itemId: string, warehouseId: string): Promise<{
    quantity: number;
    reserved: number;
    pendingOut: number;
    available: number;
  }> {
    const inventory = await this.inventoryRepo.getByItemAndWarehouse(
      this.tenantId,
      itemId,
      warehouseId
    );

    const quantity = inventory?.quantity || 0;
    const reserved = inventory?.reservedQuantity || 0;

    // Get pending outgoing transfers
    const pendingTransfers = await this.transferRepo.findWithFilters(this.tenantId, {
      fromWarehouseId: warehouseId,
      status: 'pending',
      limit: 1000,
    });

    let pendingOut = 0;
    for (const transfer of pendingTransfers.data) {
      const item = transfer.items.find(i => i.itemId === itemId);
      if (item) {
        pendingOut += item.quantity;
      }
    }

    return {
      quantity,
      reserved,
      pendingOut,
      available: quantity - reserved - pendingOut,
    };
  }
}
