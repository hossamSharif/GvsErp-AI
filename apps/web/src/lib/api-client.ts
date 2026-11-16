/**
 * API Client
 *
 * Typed HTTP client with authentication and error handling.
 */

import type { ApiError, ApiResponse, ApiListResponse, PaginationParams } from '@erp/shared';
import { getApiBaseUrl, getSupabaseAnonKey, getSupabaseUrl } from './runtime-config';
import { licenseErrorMessage } from './license-errors';

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
  // Structured, error-specific context (e.g. payments blocking an invoice delete).
  public readonly meta?: Record<string, unknown>;

  constructor(error: ApiError, status: number) {
    super(error.message);
    this.name = 'ApiClientError';
    this.code = error.code;
    this.status = status;
    this.details = error.details;
    this.meta = error.meta;
  }
}

// Reuse a single browser Supabase client across all requests. Creating a fresh
// client per call made concurrent requests (e.g. the many hooks that fire on a
// page load) each independently trigger a token refresh, racing on refresh-token
// rotation and producing spurious 401s. A singleton shares one refresh lock.
let browserSupabase: ReturnType<
  typeof import('@supabase/ssr').createBrowserClient
> | null = null;

async function getAccessToken(): Promise<string | null> {
  // Get token from Supabase session
  if (typeof window !== 'undefined') {
    if (!browserSupabase) {
      const { createBrowserClient } = await import('@supabase/ssr');
      browserSupabase = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
    }
    const { data: { session } } = await browserSupabase.auth.getSession();
    return session?.access_token ?? null;
  }
  return null;
}

/**
 * Offline transport bridge. Dynamically imported (browser-only) so Dexie never
 * loads during SSR. Returns null when offline support isn't applicable, letting
 * the normal network path run.
 */
async function offlineModule() {
  if (typeof window === 'undefined') return null;
  return import('@/lib/offline/transport');
}

/**
 * Raw network call: builds the URL, attaches the bearer token, performs the
 * fetch and parses/throws. Bypasses the offline layer entirely — used directly
 * by the sync engine to replay queued mutations (with an Idempotency-Key).
 */
export async function networkRequest<T>(
  method: HttpMethod,
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, body, headers = {} } = options;

  // Build URL with query params
  const url = new URL(`${getApiBaseUrl()}${endpoint}`);
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

  const response = await fetch(url.toString(), {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

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
    // Local edition license errors: show them in the user's language.
    const licenseMessage = licenseErrorMessage(error.code);
    if (licenseMessage) error = { ...error, message: licenseMessage };
    throw new ApiClientError(error, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

async function request<T>(
  method: HttpMethod,
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, body } = options;

  const offline = await offlineModule();
  const online = offline ? offline.isOnline() : true;

  // ---- Offline read path: serve GETs from the local mirror -----------------
  if (offline && method === 'GET' && !online) {
    return offline.readOffline<T>(endpoint, params as Record<string, unknown>);
  }
  // ---- Offline write path: run the local engine + queue for sync -----------
  if (offline && method !== 'GET' && !online) {
    return offline.writeOffline<T>(method, endpoint, body);
  }

  // ---- Online path ---------------------------------------------------------
  let data: T;
  try {
    data = await networkRequest<T>(method, endpoint, options);
  } catch (err) {
    // A genuine network failure (not an API error) while "online": fall back to
    // the local mirror for reads before surfacing the error.
    if (offline && method === 'GET' && !(err instanceof ApiClientError)) {
      try {
        return await offline.readOffline<T>(endpoint, params as Record<string, unknown>);
      } catch {
        /* fall through to original error */
      }
    }
    throw err;
  }

  // Read-through cache: mirror successful GETs into the local store.
  if (offline && method === 'GET') {
    void offline.cacheGetResponse(endpoint, data);
  }

  return data;
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
