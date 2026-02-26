/**
 * Invoice entity types for the ERP system
 * @module types/invoices
 */

import type { SortDirection } from './items';

// =============================================================================
// BASE TYPES
// =============================================================================

/**
 * Invoice type - sale or purchase
 */
export type InvoiceType = 'sale' | 'purchase';

/**
 * Invoice status workflow
 */
export type InvoiceStatus = 'draft' | 'final' | 'returned' | 'canceled';

// =============================================================================
// INVOICE ENTITY
// =============================================================================

/**
 * Core Invoice entity
 */
export interface Invoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  partyId: string | null;
  warehouseId: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  currency: string;
  exchangeRate: number;
  notes: string | null;
  createdBy: string | null;
  returnedFromId: string | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
}

/**
 * Invoice with party details
 */
export interface InvoiceWithParty extends Invoice {
  party: {
    id: string;
    name: string;
    type: 'customer' | 'supplier';
    balance: number;
  } | null;
}

/**
 * Invoice with warehouse details
 */
export interface InvoiceWithWarehouse extends Invoice {
  warehouse: {
    id: string;
    name: string;
  };
}

/**
 * Invoice with all related data
 */
export interface InvoiceWithRelations extends Invoice {
  party: {
    id: string;
    name: string;
    type: 'customer' | 'supplier';
    balance: number;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  warehouse: {
    id: string;
    name: string;
  };
  items: InvoiceItemWithDetails[];
  returnedFrom?: Invoice | null;
  creator?: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
}

/**
 * Invoice list response with pagination
 */
export interface InvoiceListResponse {
  invoices: InvoiceWithParty[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// =============================================================================
// INVOICE ITEM ENTITY
// =============================================================================

/**
 * Invoice line item
 */
export interface InvoiceItem {
  id: string;
  invoiceId: string;
  tenantId: string;
  itemId: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  lineTotal: number;
  sortOrder: number;
  createdAt: string;
}

/**
 * Invoice item with item details
 */
export interface InvoiceItemWithDetails extends InvoiceItem {
  item: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    unitOfMeasure: string;
  };
  /** Available stock in the selected warehouse (for display) */
  availableStock?: number;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating a new invoice
 */
export interface CreateInvoiceInput {
  type: InvoiceType;
  partyId?: string | null;
  warehouseId: string;
  currency?: string;
  exchangeRate?: number;
  discountAmount?: number;
  notes?: string | null;
  items: CreateInvoiceItemInput[];
}

/**
 * Input for updating an invoice (draft only)
 */
export interface UpdateInvoiceInput {
  partyId?: string | null;
  warehouseId?: string;
  currency?: string;
  exchangeRate?: number;
  discountAmount?: number;
  notes?: string | null;
  items?: UpdateInvoiceItemInput[];
}

/**
 * Input for creating an invoice line item
 */
export interface CreateInvoiceItemInput {
  itemId: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxRate?: number;
  sortOrder?: number;
}

/**
 * Input for updating an invoice line item
 */
export interface UpdateInvoiceItemInput {
  id?: string; // If present, update existing; if not, create new
  itemId: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxRate?: number;
  sortOrder?: number;
}

/**
 * Input for finalizing an invoice
 */
export interface FinalizeInvoiceInput {
  /** Optional: Update notes before finalizing */
  notes?: string;
}

/**
 * Input for creating a return invoice
 */
export interface ReturnInvoiceInput {
  /** Items to return (must be from original invoice) */
  items: ReturnInvoiceItemInput[];
  /** Reason for return */
  notes?: string;
  /** Return to different warehouse? */
  warehouseId?: string;
}

/**
 * Return item specification
 */
export interface ReturnInvoiceItemInput {
  /** Original invoice item ID */
  invoiceItemId: string;
  /** Quantity to return (must be <= original quantity) */
  returnQuantity: number;
}

// =============================================================================
// QUERY TYPES
// =============================================================================

/**
 * Sort options for invoice list
 */
export type InvoiceSortField =
  | 'invoiceNumber'
  | 'createdAt'
  | 'finalizedAt'
  | 'total'
  | 'status';

/**
 * Query parameters for fetching invoices
 */
export interface InvoiceQueryParams {
  /** Filter by invoice type */
  type?: InvoiceType;
  /** Filter by status */
  status?: InvoiceStatus | InvoiceStatus[];
  /** Filter by party ID */
  partyId?: string;
  /** Filter by warehouse ID */
  warehouseId?: string;
  /** Search by invoice number */
  search?: string;
  /** Filter by date range - start */
  dateFrom?: string;
  /** Filter by date range - end */
  dateTo?: string;
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page (default: 20, max: 100) */
  limit?: number;
  /** Sort field */
  sortBy?: InvoiceSortField;
  /** Sort direction */
  sortDir?: SortDirection;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * Result of invoice finalization
 */
export interface FinalizeInvoiceResult {
  invoice: InvoiceWithRelations;
  /** Stock movements applied (for sales/purchases) */
  stockMovements?: {
    itemId: string;
    warehouseId: string;
    quantityChange: number;
    previousQuantity: number;
    newQuantity: number;
  }[];
  /** Party balance update */
  partyBalanceUpdate?: {
    partyId: string;
    previousBalance: number;
    newBalance: number;
    change: number;
  };
}

/**
 * Result of invoice return
 */
export interface ReturnInvoiceResult {
  /** The new return invoice */
  returnInvoice: InvoiceWithRelations;
  /** The original invoice */
  originalInvoice: InvoiceWithRelations;
  /** Stock movements reversed */
  stockMovements: {
    itemId: string;
    warehouseId: string;
    quantityChange: number;
    previousQuantity: number;
    newQuantity: number;
  }[];
}

// =============================================================================
// REPORT TYPES
// =============================================================================

/**
 * Sales report entry
 */
export interface SalesReportEntry {
  id: string;
  invoiceNumber: string;
  date: string;
  partyName: string | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  status: InvoiceStatus;
  itemCount: number;
}

/**
 * Sales report summary
 */
export interface SalesReportSummary {
  totalInvoices: number;
  totalSubtotal: number;
  totalTax: number;
  totalDiscount: number;
  totalAmount: number;
  byStatus: Record<InvoiceStatus, { count: number; total: number }>;
}

/**
 * Parameters for generating sales report
 */
export interface SalesReportParams {
  /** Filter by date range - start */
  dateFrom?: string;
  /** Filter by date range - end */
  dateTo?: string;
  /** Filter by party */
  partyId?: string;
  /** Filter by warehouse */
  warehouseId?: string;
  /** Filter by status */
  status?: InvoiceStatus | InvoiceStatus[];
  /** Include summary */
  includeSummary?: boolean;
}

/**
 * Sales report response
 */
export interface SalesReportResponse {
  entries: SalesReportEntry[];
  summary?: SalesReportSummary;
  generatedAt: string;
}

/**
 * Purchase report entry (same structure as sales for consistency)
 */
export interface PurchaseReportEntry {
  id: string;
  invoiceNumber: string;
  date: string;
  partyName: string | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  status: InvoiceStatus;
  itemCount: number;
}

/**
 * Purchase report summary
 */
export interface PurchaseReportSummary {
  totalInvoices: number;
  totalSubtotal: number;
  totalTax: number;
  totalDiscount: number;
  totalAmount: number;
  byStatus: Record<InvoiceStatus, { count: number; total: number }>;
}

/**
 * Parameters for generating purchase report
 */
export interface PurchaseReportParams {
  /** Filter by date range - start */
  dateFrom?: string;
  /** Filter by date range - end */
  dateTo?: string;
  /** Filter by party (supplier) */
  partyId?: string;
  /** Filter by warehouse */
  warehouseId?: string;
  /** Filter by status */
  status?: InvoiceStatus | InvoiceStatus[];
  /** Include summary */
  includeSummary?: boolean;
}

/**
 * Purchase report response
 */
export interface PurchaseReportResponse {
  entries: PurchaseReportEntry[];
  summary?: PurchaseReportSummary;
  generatedAt: string;
}

// =============================================================================
// DRAFT TYPES (for local autosave)
// =============================================================================

/**
 * Local draft invoice (stored in browser)
 */
export interface DraftInvoice {
  id: string; // Local UUID for draft identification
  type: InvoiceType;
  partyId: string | null;
  warehouseId: string | null;
  currency: string;
  exchangeRate: number;
  discountAmount: number;
  notes: string;
  items: DraftInvoiceItem[];
  lastSavedAt: string;
  createdAt: string;
}

/**
 * Draft invoice item
 */
export interface DraftInvoiceItem {
  localId: string; // Local UUID for drag-drop tracking
  itemId: string;
  itemName: string; // Denormalized for display
  itemSku: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  lineTotal: number;
  sortOrder: number;
}
