-- Migration: 002_rls_policies
-- Description: Row Level Security policies for multi-tenant isolation
-- Created: 2025-12-13

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TENANTS POLICIES
-- ============================================

-- Users can only see their own tenant
CREATE POLICY tenant_select ON tenants
    FOR SELECT
    USING (id = get_tenant_id());

-- Only service role can insert tenants (registration flow)
CREATE POLICY tenant_insert ON tenants
    FOR INSERT
    WITH CHECK (true); -- Handled by service role

-- Users can update their own tenant settings
CREATE POLICY tenant_update ON tenants
    FOR UPDATE
    USING (id = get_tenant_id())
    WITH CHECK (id = get_tenant_id());

-- Service role bypass for tenant management
CREATE POLICY tenant_service_role ON tenants
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- ROLES POLICIES
-- ============================================

-- Users can see roles in their tenant
CREATE POLICY roles_select ON roles
    FOR SELECT
    USING (tenant_id = get_tenant_id());

-- Only admins can create roles
CREATE POLICY roles_insert ON roles
    FOR INSERT
    WITH CHECK (
        tenant_id = get_tenant_id()
        AND user_has_permission('roles:write')
    );

-- Only admins can update roles (except system roles)
CREATE POLICY roles_update ON roles
    FOR UPDATE
    USING (
        tenant_id = get_tenant_id()
        AND user_has_permission('roles:write')
        AND NOT is_system
    )
    WITH CHECK (
        tenant_id = get_tenant_id()
        AND NOT is_system
    );

-- Only admins can delete roles (except system roles)
CREATE POLICY roles_delete ON roles
    FOR DELETE
    USING (
        tenant_id = get_tenant_id()
        AND user_has_permission('roles:write')
        AND NOT is_system
    );

-- Service role bypass for role management
CREATE POLICY roles_service_role ON roles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- USERS POLICIES
-- ============================================

-- Users can see other users in their tenant
CREATE POLICY users_select ON users
    FOR SELECT
    USING (tenant_id = get_tenant_id());

-- Only admins can create users
CREATE POLICY users_insert ON users
    FOR INSERT
    WITH CHECK (
        tenant_id = get_tenant_id()
        AND (
            user_has_permission('users:write')
            OR user_has_permission('*')
        )
    );

-- Users can update their own profile, admins can update any user
CREATE POLICY users_update ON users
    FOR UPDATE
    USING (
        tenant_id = get_tenant_id()
        AND (
            id = get_user_id()
            OR user_has_permission('users:write')
        )
    )
    WITH CHECK (tenant_id = get_tenant_id());

-- Only admins can deactivate users
CREATE POLICY users_delete ON users
    FOR DELETE
    USING (
        tenant_id = get_tenant_id()
        AND user_has_permission('users:write')
        AND id != get_user_id() -- Cannot delete yourself
    );

-- Service role bypass for user management
CREATE POLICY users_service_role ON users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant permissions on tables
GRANT SELECT ON tenants TO authenticated;
GRANT UPDATE ON tenants TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON roles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Service role has full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
