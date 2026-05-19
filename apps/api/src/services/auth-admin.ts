/**
 * Shared admin-scoped Supabase client and JWT metadata sync helper.
 *
 * The auth middleware now resolves permissions from the DB on every request, so
 * `user_metadata` is no longer the source of truth — but we still keep it in
 * sync so anything that decodes the JWT client-side (or future flows that read
 * it) sees fresh values.
 */

import { SupabaseClient, createClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import type { Permission } from '@erp/shared';

let adminClient: SupabaseClient<Database> | null = null;

export function getAdminClient(): SupabaseClient<Database> {
  if (adminClient) return adminClient;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for user-admin operations'
    );
  }
  adminClient = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}

export interface UserAuthMetadata {
  tenant_id: string;
  role: string;
  permissions: Permission[];
  full_name?: string | null;
}

/**
 * Replace a user's auth.users.user_metadata with the given fields.
 * Note: Supabase's updateUserById replaces user_metadata wholesale, so callers
 * must pass every field they want preserved (full_name included).
 */
export async function syncUserAuthMetadata(
  userId: string,
  metadata: UserAuthMetadata
): Promise<void> {
  await getAdminClient().auth.admin.updateUserById(userId, {
    user_metadata: {
      tenant_id: metadata.tenant_id,
      role: metadata.role,
      permissions: metadata.permissions,
      full_name: metadata.full_name ?? null,
    },
  });
}

/**
 * Resolve a role's name + permissions for use in user_metadata. Returns empty
 * defaults when roleId is null (e.g. user has no role assigned yet).
 */
export async function resolveRoleClaims(
  supabase: SupabaseClient<Database>,
  roleId: string | null
): Promise<{ role: string; permissions: Permission[] }> {
  if (!roleId) return { role: '', permissions: [] };
  const { data } = await supabase
    .from('roles')
    .select('name, permissions')
    .eq('id', roleId)
    .single();
  if (!data) return { role: '', permissions: [] };
  return {
    role: data.name,
    permissions: (Array.isArray(data.permissions) ? data.permissions : []) as Permission[],
  };
}
