-- Migration: 010_audit_schema
-- Description: Create AuditLog table for comprehensive audit trail
-- Depends on: 001_core_schema (tenants, users)

-- =============================================================================
-- AUDIT LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT audit_logs_action_not_empty CHECK (char_length(action) > 0),
    CONSTRAINT audit_logs_entity_type_not_empty CHECK (char_length(entity_type) > 0)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Tenant isolation (most important)
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);

-- Common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(tenant_id, entity_type, entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(tenant_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(tenant_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(tenant_id, entity_type);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_date ON audit_logs(tenant_id, entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date ON audit_logs(tenant_id, user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    FOR ALL
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

DROP POLICY IF EXISTS service_role_bypass_audit_logs ON audit_logs;
CREATE POLICY service_role_bypass_audit_logs ON audit_logs
    FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

/**
 * Function to log audit entries
 * This can be called from triggers or application code
 */
CREATE OR REPLACE FUNCTION log_audit(
    p_tenant_id UUID,
    p_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        tenant_id,
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        ip_address,
        user_agent
    ) VALUES (
        p_tenant_id,
        p_user_id,
        p_action,
        p_entity_type,
        p_entity_id,
        p_old_values,
        p_new_values,
        p_ip_address,
        p_user_agent
    )
    RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Function to get audit logs with filters
 */
CREATE OR REPLACE FUNCTION get_audit_logs(
    p_tenant_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_action TEXT DEFAULT NULL,
    p_date_from TIMESTAMPTZ DEFAULT NULL,
    p_date_to TIMESTAMPTZ DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    action TEXT,
    entity_type TEXT,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        al.id,
        al.user_id,
        u.email AS user_email,
        u.full_name AS user_name,
        al.action,
        al.entity_type,
        al.entity_id,
        al.old_values,
        al.new_values,
        al.ip_address,
        al.user_agent,
        al.created_at
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.tenant_id = p_tenant_id
      AND (p_user_id IS NULL OR al.user_id = p_user_id)
      AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
      AND (p_entity_id IS NULL OR al.entity_id = p_entity_id)
      AND (p_action IS NULL OR al.action = p_action)
      AND (p_date_from IS NULL OR al.created_at >= p_date_from)
      AND (p_date_to IS NULL OR al.created_at <= p_date_to)
    ORDER BY al.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Function to get audit log count with filters
 */
CREATE OR REPLACE FUNCTION count_audit_logs(
    p_tenant_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_action TEXT DEFAULT NULL,
    p_date_from TIMESTAMPTZ DEFAULT NULL,
    p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM audit_logs al
    WHERE al.tenant_id = p_tenant_id
      AND (p_user_id IS NULL OR al.user_id = p_user_id)
      AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
      AND (p_entity_id IS NULL OR al.entity_id = p_entity_id)
      AND (p_action IS NULL OR al.action = p_action)
      AND (p_date_from IS NULL OR al.created_at >= p_date_from)
      AND (p_date_to IS NULL OR al.created_at <= p_date_to);

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PARTITIONING PREPARATION (Optional - for future optimization)
-- =============================================================================

-- Note: For large scale deployments, consider partitioning audit_logs by date
-- This can be implemented later when the table grows large
-- Example: CREATE TABLE audit_logs_2025_12 PARTITION OF audit_logs
--          FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all system actions';
COMMENT ON COLUMN audit_logs.tenant_id IS 'Tenant that owns this audit log entry';
COMMENT ON COLUMN audit_logs.user_id IS 'User who performed the action (NULL for system actions)';
COMMENT ON COLUMN audit_logs.action IS 'Type of action: create, update, delete, login, etc.';
COMMENT ON COLUMN audit_logs.entity_type IS 'Type of entity affected: item, invoice, party, etc.';
COMMENT ON COLUMN audit_logs.entity_id IS 'ID of the affected entity (NULL for list operations)';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous state of the entity (for updates/deletes)';
COMMENT ON COLUMN audit_logs.new_values IS 'New state of the entity (for creates/updates)';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the client';
COMMENT ON COLUMN audit_logs.user_agent IS 'Browser/client user agent string';
COMMENT ON COLUMN audit_logs.created_at IS 'Timestamp when the action occurred';
