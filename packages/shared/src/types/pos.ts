/**
 * POS (Point of Sale) Types
 * Phase 7: User Story 5 - Manage Point of Sale Locations
 */

/**
 * Receipt configuration settings
 */
export interface POSReceiptSettings {
  header?: string;
  footer?: string;
  show_logo?: boolean;
  logo_url?: string;
  show_barcode?: boolean;
}

/**
 * Discount configuration settings
 */
export interface POSDiscountSettings {
  max_discount_percent?: number;
  require_manager_approval?: boolean;
  manager_approval_threshold?: number;
}

/**
 * Loyalty program configuration
 */
export interface POSLoyaltySettings {
  enabled?: boolean;
  points_per_currency?: number;
  redemption_rate?: number;
}

/**
 * Tax configuration settings
 */
export interface POSTaxSettings {
  default_rate?: number;
  tax_inclusive?: boolean;
}

/**
 * POS Location settings (stored as JSONB)
 */
export interface POSLocationSettings {
  receipt?: POSReceiptSettings;
  discounts?: POSDiscountSettings;
  loyalty?: POSLoyaltySettings;
  tax?: POSTaxSettings;
  payment_methods?: string[];
}

/**
 * POS Location entity
 */
export interface POSLocation {
  id: string;
  tenant_id: string;
  name: string;
  warehouse_id: string;
  settings: POSLocationSettings;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Create POS Location request
 */
export interface CreatePOSLocationRequest {
  name: string;
  warehouse_id: string;
  settings?: POSLocationSettings;
}

/**
 * Update POS Location request
 */
export interface UpdatePOSLocationRequest {
  name?: string;
  warehouse_id?: string;
  settings?: POSLocationSettings;
  is_active?: boolean;
}

/**
 * POS Location with warehouse details
 */
export interface POSLocationWithWarehouse extends POSLocation {
  warehouse: {
    id: string;
    name: string;
  };
}

/**
 * Quick sale request (simplified invoice creation from POS terminal)
 */
export interface QuickSaleRequest {
  items: QuickSaleItem[];
  party_id?: string;
  discount_percent?: number;
  discount_amount?: number;
  notes?: string;
  payment_method?: string;
}

/**
 * Quick sale item
 */
export interface QuickSaleItem {
  item_id: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
}

/**
 * Quick sale response (created invoice)
 */
export interface QuickSaleResponse {
  invoice_id: string;
  invoice_number: string;
  total: number;
  receipt_url?: string;
}

/**
 * POS sale summary (for terminal display)
 */
export interface POSSaleSummary {
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  items_count: number;
}
