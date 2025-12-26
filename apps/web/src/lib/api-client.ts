/**
 * API Client
 *
 * Typed HTTP client with authentication and error handling.
 */

import type { ApiError, ApiResponse, ApiListResponse, PaginationParams } from '@erp-saas/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>;
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

// Cached supabase client for the browser
let browserSupabase: ReturnType<typeof import('@supabase/ssr').createBrowserClient> | null = null;

async function getSupabaseClient() {
  if (typeof window === 'undefined') return null;

  if (!browserSupabase) {
    const { createBrowserClient } = await import('@supabase/ssr');
    browserSupabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserSupabase;
}

async function getAccessToken(): Promise<string | null> {
  // Get token from Supabase session
  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  // First try to get existing session
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    // Check if token is expired or about to expire (within 60 seconds)
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);

    if (expiresAt && expiresAt - now < 60) {
      // Token is expired or about to expire, try to refresh
      console.log('Token expiring soon, attempting refresh...');
      const { data: refreshData } = await supabase.auth.refreshSession();
      if (refreshData.session?.access_token) {
        return refreshData.session.access_token;
      }
    }

    return session.access_token;
  }

  return null;
}

async function request<T>(
  method: HttpMethod,
  endpoint: string,
  options: RequestOptions = {},
  retryCount: number = 0
): Promise<T> {
  const { params, body, headers = {} } = options;

  // Build URL with query params
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
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
  } else {
    console.warn('No access token available for API request to:', endpoint);
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

    // If 401 and we haven't retried yet, try refreshing the token
    if (response.status === 401 && retryCount === 0) {
      console.log('Got 401, attempting token refresh and retry...');
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (refreshData.session?.access_token) {
          // Retry the request with the new token
          return request<T>(method, endpoint, options, retryCount + 1);
        }
      }
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
  get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) {
    return request<T>('GET', endpoint, { params });
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
  filters: Record<string, string | number | boolean | undefined> = {}
) {
  return api.get<ApiListResponse<T>>(endpoint, {
    page: pagination.page || 1,
    limit: pagination.limit || 50,
    ...filters,
  });
}

// Export error class for type checking
export { ApiClientError };
