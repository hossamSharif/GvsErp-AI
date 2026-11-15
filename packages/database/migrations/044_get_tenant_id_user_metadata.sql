-- 044_get_tenant_id_user_metadata.sql
--
-- get_tenant_id() (001) reads a top-level `tenant_id` JWT claim. GoTrue never
-- issues one: the API stores tenant_id in user_metadata (see
-- apps/api/src/services/auth-admin.ts syncUserAuthMetadata). On a fresh
-- database this made every policy built on get_tenant_id() (tenants, roles,
-- users — 002_rls_policies.sql) match nothing, so the API answered
-- "User profile not found" for every signed-in user.
--
-- The cloud database works because it was changed outside the migrations
-- (edited function or a custom access-token hook). This captures that:
-- prefer the top-level claim (set by a hook, if any), fall back to
-- user_metadata — the same source the later *_fix_*_rls_jwt migrations use.
-- Returns the same value as before wherever the old version worked.

CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        auth.jwt() ->> 'tenant_id',
        auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )::uuid;
EXCEPTION
    WHEN others THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
