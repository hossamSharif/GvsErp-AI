/**
 * API Response Types
 *
 * Shared types for API responses, pagination, and errors.
 */

// ============================================
// PAGINATION
// ============================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  /**
   * Sum of the monetary `total` across ALL rows matching the current filters
   * (not just the returned page). Populated by list endpoints that expose a
   * filtered grand total — e.g. the invoices list. Optional elsewhere.
   */
  totalAmount?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiListResponse<T> {
  data: T[];
  meta?: PaginationMeta;
}

// ============================================
// ERROR RESPONSES
// ============================================

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'LIMIT_EXCEEDED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  // Local edition license (apps/api/src/lib/license)
  | 'LICENSE_READ_ONLY'
  | 'LICENSE_USER_LIMIT'
  | 'LICENSE_INVALID';

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: ValidationError[];
  // Structured, error-specific context (e.g. the payments blocking an invoice
  // delete). Distinct from `details`, which is reserved for field validation.
  meta?: Record<string, unknown>;
  request_id?: string;
}

// ============================================
// SORT & FILTER
// ============================================

export type SortOrder = 'asc' | 'desc';

export interface SortParams {
  sort_by?: string;
  sort_order?: SortOrder;
}

export interface DateRangeParams {
  start_date?: string;
  end_date?: string;
}

export interface SearchParams {
  search?: string;
}

// ============================================
// COMMON QUERY PARAMS
// ============================================

export interface ListQueryParams extends PaginationParams, SortParams, SearchParams {
  is_active?: boolean;
}

// ============================================
// BULK OPERATIONS
// ============================================

export interface BulkOperationResult {
  success_count: number;
  failure_count: number;
  errors?: Array<{
    id: string;
    error: string;
  }>;
}

// ============================================
// HTTP STATUS HELPERS
// ============================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

// ============================================
// REQUEST CONTEXT
// ============================================

export interface RequestContext {
  user_id: string;
  tenant_id: string;
  permissions: string[];
  request_id: string;
  ip_address?: string;
  user_agent?: string;
}
