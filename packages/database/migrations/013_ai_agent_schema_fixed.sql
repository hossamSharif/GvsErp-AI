-- Migration 013: AI Agent Assistant Schema (Fixed)
-- Created: 2025-12-26
-- Description: Database schema for AI Agent Assistant feature

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Consultant role types
CREATE TYPE consultant_role AS ENUM (
  'general',
  'marketing',
  'legal',
  'customer_service',
  'financial_analyst'
);

-- Conversation status
CREATE TYPE conversation_status AS ENUM (
  'active',
  'archived'
);

-- Message role (speaker)
CREATE TYPE message_role AS ENUM (
  'user',
  'assistant',
  'system'
);

-- Document processing status
CREATE TYPE processing_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

-- Task type (transaction types)
CREATE TYPE task_type AS ENUM (
  'invoice',
  'purchase_order',
  'sales_order',
  'payment',
  'journal_entry'
);

-- Task approval status
CREATE TYPE approval_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'executed'
);

-- Usage action type for tracking
CREATE TYPE usage_action_type AS ENUM (
  'question',
  'document',
  'task'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- AI Conversations
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  consultant_role consultant_role NOT NULL DEFAULT 'general',
  status conversation_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- AI Messages
CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role message_role NOT NULL,
  content TEXT NOT NULL CHECK (LENGTH(content) <= 100000),
  document_ids UUID[],
  token_count INTEGER NOT NULL DEFAULT 0 CHECK (token_count >= 0),
  model_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- AI Documents
CREATE TABLE ai_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES ai_messages(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('application/pdf', 'image/png', 'image/jpeg', 'image/jpg')),
  file_size INTEGER NOT NULL CHECK (file_size <= 10485760),
  storage_path TEXT NOT NULL CHECK (storage_path LIKE 'ai-documents/%'),
  extracted_text TEXT,
  processing_status processing_status NOT NULL DEFAULT 'pending',
  processing_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- AI Tasks (AI-generated transactions)
CREATE TABLE ai_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES ai_messages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_type task_type NOT NULL,
  generated_data JSONB NOT NULL,
  approval_status approval_status NOT NULL DEFAULT 'pending',
  executed_at TIMESTAMP WITH TIME ZONE,
  result_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT executed_at_check CHECK (
    (approval_status = 'executed' AND executed_at IS NOT NULL) OR
    (approval_status != 'executed' AND executed_at IS NULL)
  )
);

-- AI Usage Records (tier enforcement and billing)
CREATE TABLE ai_usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type usage_action_type NOT NULL,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  model_used TEXT NOT NULL,
  cost_estimate DECIMAL(10,4) CHECK (cost_estimate >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- AI Audit Logs (permanent audit trail)
CREATE TABLE ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (LENGTH(action) > 0),
  prompt TEXT,
  response TEXT CHECK (LENGTH(response) <= 10000),
  data_accessed JSONB,
  permissions TEXT[],
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- AI Configurations (system-wide and tenant-specific settings)
CREATE TABLE ai_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  config_key TEXT NOT NULL CHECK (config_key ~ '^[a-z_]+$'),
  config_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, config_key)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- ai_conversations indexes
CREATE INDEX idx_ai_conversations_tenant_user ON ai_conversations(tenant_id, user_id, deleted_at);
CREATE INDEX idx_ai_conversations_created_at ON ai_conversations(created_at);
CREATE INDEX idx_ai_conversations_updated_at ON ai_conversations(updated_at);

-- ai_messages indexes
CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);
CREATE INDEX idx_ai_messages_role ON ai_messages(role);

-- ai_documents indexes
CREATE INDEX idx_ai_documents_conversation ON ai_documents(conversation_id);
CREATE INDEX idx_ai_documents_tenant_user ON ai_documents(tenant_id, user_id);
CREATE INDEX idx_ai_documents_processing_status ON ai_documents(processing_status);

-- ai_tasks indexes
CREATE INDEX idx_ai_tasks_tenant_user_status ON ai_tasks(tenant_id, user_id, approval_status);
CREATE INDEX idx_ai_tasks_conversation ON ai_tasks(conversation_id);

-- ai_usage_records indexes
CREATE INDEX idx_ai_usage_tenant_created ON ai_usage_records(tenant_id, created_at);
CREATE INDEX idx_ai_usage_user_created_type ON ai_usage_records(user_id, created_at, action_type);
CREATE INDEX idx_ai_usage_created_at ON ai_usage_records(created_at);

-- ai_audit_logs indexes
CREATE INDEX idx_ai_audit_tenant_created ON ai_audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_ai_audit_user_created ON ai_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_ai_audit_conversation ON ai_audit_logs(conversation_id);

-- ai_configurations indexes
CREATE INDEX idx_ai_config_key ON ai_configurations(config_key);

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configurations ENABLE ROW LEVEL SECURITY;

-- ai_conversations policies
CREATE POLICY "Users can view own conversations"
  ON ai_conversations FOR SELECT
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid());

CREATE POLICY "Users can create conversations"
  ON ai_conversations FOR INSERT
  WITH CHECK (tenant_id::text = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid());

CREATE POLICY "Users can update own conversations"
  ON ai_conversations FOR UPDATE
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid());

-- ai_messages policies
CREATE POLICY "Users can view messages in own conversations"
  ON ai_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM ai_conversations
      WHERE tenant_id::text = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations"
  ON ai_messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM ai_conversations
      WHERE tenant_id::text = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid()
    )
  );

-- ai_documents policies
CREATE POLICY "Users can view own documents"
  ON ai_documents FOR SELECT
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid());

CREATE POLICY "Users can upload documents"
  ON ai_documents FOR INSERT
  WITH CHECK (tenant_id::text = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid());

-- ai_tasks policies
CREATE POLICY "Users can view own tasks"
  ON ai_tasks FOR SELECT
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid());

CREATE POLICY "Users can update own tasks"
  ON ai_tasks FOR UPDATE
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid());

-- ai_usage_records policies
CREATE POLICY "Users can view own usage"
  ON ai_usage_records FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service can insert usage records"
  ON ai_usage_records FOR INSERT
  WITH CHECK (true);

-- ai_audit_logs policies
-- Admin check: User must have a role with "audit:read" in permissions
CREATE POLICY "Admins can view tenant audit logs"
  ON ai_audit_logs FOR SELECT
  USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id'
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.permissions ? 'audit:read'
    )
  );

CREATE POLICY "Service can insert audit logs"
  ON ai_audit_logs FOR INSERT
  WITH CHECK (true);

-- ai_configurations policies
CREATE POLICY "Users can read tenant configs"
  ON ai_configurations FOR SELECT
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id' OR tenant_id IS NULL);

-- Admin check: User must have a role with "settings:write" in permissions
CREATE POLICY "Admins can modify tenant configs"
  ON ai_configurations FOR ALL
  USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id'
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.permissions ? 'settings:write'
    )
  );

-- Super admin check: System roles with is_system = true
CREATE POLICY "SaaS admins can modify system configs"
  ON ai_configurations FOR ALL
  USING (
    tenant_id IS NULL
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.is_system = true
    )
  );

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- Function: Cleanup old conversations (90-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_ai_conversations()
RETURNS void AS $$
BEGIN
  UPDATE ai_conversations
  SET deleted_at = NOW()
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get usage stats for user
CREATE OR REPLACE FUNCTION get_user_ai_usage(
  p_user_id UUID,
  p_period TEXT DEFAULT 'today'
)
RETURNS TABLE (
  questions INTEGER,
  documents INTEGER,
  tasks INTEGER
) AS $$
DECLARE
  start_date TIMESTAMP;
BEGIN
  IF p_period = 'today' THEN
    start_date := CURRENT_DATE;
  ELSIF p_period = 'month' THEN
    start_date := DATE_TRUNC('month', CURRENT_DATE);
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE action_type = 'question')::INTEGER AS questions,
    COUNT(*) FILTER (WHERE action_type = 'document')::INTEGER AS documents,
    COUNT(*) FILTER (WHERE action_type = 'task')::INTEGER AS tasks
  FROM ai_usage_records
  WHERE user_id = p_user_id
    AND created_at >= start_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check tier limits
-- Note: Assumes users table has subscription_tier column
CREATE OR REPLACE FUNCTION check_ai_tier_limit(
  p_user_id UUID,
  p_action_type usage_action_type
)
RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
  usage_count INTEGER;
  limit_value INTEGER;
BEGIN
  -- Try to get subscription tier from users table
  -- If column doesn't exist, default to 'free'
  BEGIN
    SELECT COALESCE(
      (SELECT subscription_tier FROM users WHERE id = p_user_id),
      'free'
    ) INTO user_tier;
  EXCEPTION
    WHEN undefined_column THEN
      user_tier := 'free';
  END;

  -- Get usage count for today/month based on action type
  IF p_action_type = 'question' THEN
    SELECT COUNT(*) INTO usage_count
    FROM ai_usage_records
    WHERE user_id = p_user_id
      AND action_type = 'question'
      AND created_at >= CURRENT_DATE;

    limit_value := CASE user_tier
      WHEN 'free' THEN 25
      ELSE 999999
    END;
  ELSIF p_action_type = 'document' THEN
    SELECT COUNT(*) INTO usage_count
    FROM ai_usage_records
    WHERE user_id = p_user_id
      AND action_type = 'document'
      AND created_at >= DATE_TRUNC('month', CURRENT_DATE);

    limit_value := CASE user_tier
      WHEN 'free' THEN 3
      ELSE 100
    END;
  ELSIF p_action_type = 'task' THEN
    SELECT COUNT(*) INTO usage_count
    FROM ai_usage_records
    WHERE user_id = p_user_id
      AND action_type = 'task'
      AND created_at >= DATE_TRUNC('month', CURRENT_DATE);

    limit_value := CASE user_tier
      WHEN 'free' THEN 5
      ELSE 999999
    END;
  END IF;

  RETURN usage_count < limit_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- AUTOMATED CLEANUP WITH PG_CRON
-- ============================================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup job (runs daily at 2 AM)
SELECT cron.schedule(
  'cleanup-old-ai-conversations',
  '0 2 * * *',
  $$
    SELECT cleanup_old_ai_conversations();
  $$
);

-- ============================================================================
-- DEFAULT SYSTEM CONFIGURATIONS
-- ============================================================================

-- Insert default system configurations
INSERT INTO ai_configurations (tenant_id, config_key, config_value) VALUES
  (NULL, 'default_model', '{"provider": "anthropic", "model": "claude-sonnet-4-5"}'::jsonb),
  (NULL, 'summary_model', '{"provider": "anthropic", "model": "claude-haiku-4"}'::jsonb),
  (NULL, 'rate_limits', '{"questions_per_minute": 10, "questions_per_day_free": 25, "documents_per_month_free": 3, "tasks_per_month_free": 5, "documents_per_month_premium": 100}'::jsonb),
  (NULL, 'context_window', '{"max_recent_messages": 20, "enable_summarization": true}'::jsonb),
  (NULL, 'enabled_roles', '["general", "marketing", "legal", "customer_service", "financial_analyst"]'::jsonb);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp for ai_conversations
CREATE OR REPLACE FUNCTION update_ai_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_conversation_timestamp
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_conversation_timestamp();

-- Auto-update updated_at timestamp for ai_configurations
CREATE OR REPLACE FUNCTION update_ai_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_config_timestamp
  BEFORE UPDATE ON ai_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_config_timestamp();
