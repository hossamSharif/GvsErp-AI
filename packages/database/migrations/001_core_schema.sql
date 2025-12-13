-- Migration: 001_core_schema
-- Description: Core tables for multi-tenant ERP system (tenants, users, roles)
-- Created: 2025-12-13

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE subscription_plan AS ENUM ('freemium', 'premium');
CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'canceled', 'past_due');

-- ============================================
-- TENANTS TABLE
-- ============================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 255),
    subscription_plan subscription_plan NOT NULL DEFAULT 'freemium',
    subscription_status subscription_status NOT NULL DEFAULT 'active',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    settings JSONB NOT NULL DEFAULT '{
        "default_language": "en",
        "default_theme": "light",
        "default_currency": "USD",
        "modules": {
            "stock": true,
            "accounting": false,
            "hr": false
        },
        "limits": {
            "max_items": 50,
            "max_users": 1,
            "max_transactions_per_month": 25
        }
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for tenant lookups
CREATE INDEX idx_tenants_stripe_customer ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ============================================
-- ROLES TABLE
-- ============================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Unique role name per tenant
    UNIQUE (tenant_id, name)
);

-- Index for role lookups
CREATE INDEX idx_roles_tenant ON roles(tenant_id);

-- ============================================
-- USERS TABLE
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY, -- Links to auth.users in Supabase
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    full_name TEXT,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Unique email per tenant
    UNIQUE (tenant_id, email)
);

-- Indexes for user lookups
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(tenant_id, email);
CREATE INDEX idx_users_role ON users(role_id) WHERE role_id IS NOT NULL;

-- ============================================
-- AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DEFAULT ROLES FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION create_default_roles(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    -- Admin role: Full access
    INSERT INTO roles (tenant_id, name, permissions, is_system)
    VALUES (
        p_tenant_id,
        'admin',
        '["*"]'::jsonb,
        true
    );

    -- Sales role: Items read, invoices/customers CRUD
    INSERT INTO roles (tenant_id, name, permissions, is_system)
    VALUES (
        p_tenant_id,
        'sales',
        '["items:read", "invoices:read", "invoices:write", "invoices:delete", "parties:read", "parties:write", "payments:read", "payments:write", "reports:read"]'::jsonb,
        true
    );

    -- Warehouse role: Items and warehouse management
    INSERT INTO roles (tenant_id, name, permissions, is_system)
    VALUES (
        p_tenant_id,
        'warehouse',
        '["items:read", "items:write", "warehouses:read", "warehouses:write", "transfers:read", "transfers:write", "inventory:read", "inventory:write"]'::jsonb,
        true
    );

    -- Viewer role: Read-only access
    INSERT INTO roles (tenant_id, name, permissions, is_system)
    VALUES (
        p_tenant_id,
        'viewer',
        '["items:read", "invoices:read", "parties:read", "warehouses:read", "inventory:read", "reports:read"]'::jsonb,
        true
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TENANT CREATION TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION on_tenant_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_default_roles(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_after_insert
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION on_tenant_created();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get tenant_id from JWT claims
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (auth.jwt() ->> 'tenant_id')::uuid;
EXCEPTION
    WHEN others THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user_id from JWT
CREATE OR REPLACE FUNCTION get_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_permissions JSONB;
BEGIN
    SELECT r.permissions INTO user_permissions
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid();

    -- Check for wildcard permission
    IF user_permissions ? '*' THEN
        RETURN true;
    END IF;

    -- Check for specific permission
    RETURN user_permissions ? permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
