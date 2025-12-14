/**
 * POS Validation Schemas (Zod)
 * Phase 7: User Story 5 - Manage Point of Sale Locations
 */

import { z } from 'zod';

/**
 * Receipt settings schema
 */
export const posReceiptSettingsSchema = z.object({
  header: z.string().optional(),
  footer: z.string().optional(),
  show_logo: z.boolean().optional(),
  logo_url: z.string().url().optional(),
  show_barcode: z.boolean().optional(),
});

/**
 * Discount settings schema
 */
export const posDiscountSettingsSchema = z.object({
  max_discount_percent: z.number().min(0).max(100).optional(),
  require_manager_approval: z.boolean().optional(),
  manager_approval_threshold: z.number().min(0).max(100).optional(),
});

/**
 * Loyalty settings schema
 */
export const posLoyaltySettingsSchema = z.object({
  enabled: z.boolean().optional(),
  points_per_currency: z.number().min(0).optional(),
  redemption_rate: z.number().min(0).max(1).optional(),
});

/**
 * Tax settings schema
 */
export const posTaxSettingsSchema = z.object({
  default_rate: z.number().min(0).max(100).optional(),
  tax_inclusive: z.boolean().optional(),
});

/**
 * POS Location settings schema
 */
export const posLocationSettingsSchema = z.object({
  receipt: posReceiptSettingsSchema.optional(),
  discounts: posDiscountSettingsSchema.optional(),
  loyalty: posLoyaltySettingsSchema.optional(),
  tax: posTaxSettingsSchema.optional(),
  payment_methods: z.array(z.string()).optional(),
});

/**
 * Create POS Location schema
 */
export const createPOSLocationSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  warehouse_id: z.string().uuid(),
  settings: posLocationSettingsSchema.optional(),
});

/**
 * Update POS Location schema
 */
export const updatePOSLocationSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  warehouse_id: z.string().uuid().optional(),
  settings: posLocationSettingsSchema.optional(),
  is_active: z.boolean().optional(),
});

/**
 * Quick sale item schema
 */
export const quickSaleItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  discount_percent: z.number().min(0).max(100).optional(),
});

/**
 * Quick sale request schema
 */
export const quickSaleRequestSchema = z.object({
  items: z.array(quickSaleItemSchema).min(1),
  party_id: z.string().uuid().optional(),
  discount_percent: z.number().min(0).max(100).optional(),
  discount_amount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  payment_method: z.string().optional(),
});

/**
 * POS Location ID param schema
 */
export const posLocationIdParamSchema = z.object({
  id: z.string().uuid(),
});
