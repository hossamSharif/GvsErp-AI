/**
 * Supabase Client Wrapper
 *
 * Provides configured Supabase clients for different contexts:
 * - Server-side with service role (admin operations)
 * - Server-side with user JWT (authenticated operations)
 * - Client-side with anon key (browser operations)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/database.types';

// Environment validation
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Create a Supabase client for server-side operations with service role.
 * This client bypasses RLS and should only be used for admin operations.
 *
 * WARNING: Never expose this client to the browser!
 */
export function createServiceClient(): SupabaseClient<Database> {
  if (!SUPABASE_URL) {
    throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client for server-side operations with user JWT.
 * This client respects RLS policies based on the user's JWT claims.
 *
 * @param accessToken - User's JWT access token
 */
export function createServerClient(accessToken: string): SupabaseClient<Database> {
  if (!SUPABASE_URL) {
    throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_ANON_KEY environment variable');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client for client-side operations.
 * This client uses the anon key and respects RLS policies.
 *
 * Note: For Next.js, prefer using @supabase/ssr createBrowserClient
 */
export function createBrowserClient(): SupabaseClient<Database> {
  if (!SUPABASE_URL) {
    throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_ANON_KEY environment variable');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

/**
 * Type-safe table names
 */
export type TableName = keyof Database['public']['Tables'];

/**
 * Get row type for a table
 */
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];

/**
 * Get insert type for a table
 */
export type InsertRow<T extends TableName> = Database['public']['Tables'][T]['Insert'];

/**
 * Get update type for a table
 */
export type UpdateRow<T extends TableName> = Database['public']['Tables'][T]['Update'];

// Export types
export type { Database };
export type { SupabaseClient };
export { createClient };
