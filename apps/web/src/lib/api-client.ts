/**
 * API Client
 *
 * Typed HTTP client with authentication and error handling.
 */

import type { ApiError, ApiResponse, ApiListResponse, PaginationParams } from '@erp/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type QueryParamValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryParamValue | QueryParamValue[]>;

interface RequestOptions {
  params?: QueryParams;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(error: ApiError, status: number) {
    super(error.message);
    this.name = 'ApiClientError';
    this.code = error.code;
    this.status = status;
    this.details = error.details;
  }
}

async function getAccessToken(): Promise<string | null> {
  // Get token from Supabase session
  if (typeof window !== 'undefined') {
    const { createBrowserClient } = await import('@supabase/ssr');
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }
  return null;
}

async function request<T>(
  method: HttpMethod,
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, body, headers = {} } = options;

  // Build URL with query params
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        value.forEach((v) => {
          if (v !== undefined && v !== null) {
            url.searchParams.append(key, String(v));
          }
        });
      } else {
        url.searchParams.append(key, String(value));
      }
    });
  }

  // Get auth token
  const accessToken = await getAccessToken();

  // Build headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (accessToken) {
    requestHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  // Make request
  const response = await fetch(url.toString(), {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  // Handle response
  if (!response.ok) {
    let error: ApiError;
    try {
      error = await response.json();
    } catch {
      error = {
        code: 'INTERNAL_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    throw new ApiClientError(error, response.status);
  }

  // Handle empty response
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Typed API client methods
export const api = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get<T>(endpoint: string, params?: Record<string, any>) {
    return request<T>('GET', endpoint, { params: params as QueryParams });
  },

  post<T>(endpoint: string, body?: unknown) {
    return request<T>('POST', endpoint, { body });
  },

  put<T>(endpoint: string, body?: unknown) {
    return request<T>('PUT', endpoint, { body });
  },

  patch<T>(endpoint: string, body?: unknown) {
    return request<T>('PATCH', endpoint, { body });
  },

  delete<T>(endpoint: string) {
    return request<T>('DELETE', endpoint);
  },
};

// Helper for paginated requests
export function getPaginated<T>(
  endpoint: string,
  pagination: PaginationParams = {},
  filters: Record<string, any> = {}
) {
  return api.get<ApiListResponse<T>>(endpoint, {
    page: pagination.page || 1,
    limit: pagination.limit || 50,
    ...filters,
  });
}

// Export error class for type checking
export { ApiClientError };
