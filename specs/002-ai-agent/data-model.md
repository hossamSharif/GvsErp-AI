# Data Model: AI Agent Assistant

**Feature**: AI Agent Assistant
**Date**: 2025-12-26
**Phase**: 1 - Design

## Overview

This document defines the database schema, entities, relationships, and validation rules for the AI Agent Assistant feature. All entities follow the existing ERP system's multi-tenant architecture with Row-Level Security (RLS) policies.

## Entity Relationship Diagram

```
┌─────────────────┐
│   tenants       │
│  (existing)     │
└────────┬────────┘
         │
         │ 1:N
         │
┌────────▼────────────────────┐
│  ai_conversations           │
│────────────────────────────│
│ id (uuid, PK)               │
│ tenant_id (uuid, FK)        │
│ user_id (uuid, FK)          │
│ title (text)                │
│ consultant_role (enum)      │
│ status (enum)               │
│ created_at (timestamp)      │
│ updated_at (timestamp)      │
│ deleted_at (timestamp?)     │
└────────┬────────────────────┘
         │
         │ 1:N
         │
┌────────▼────────────────────┐
│  ai_messages                │
│────────────────────────────│
│ id (uuid, PK)               │
│ conversation_id (uuid, FK)  │
│ role (enum)                 │
│ content (text)              │
│ document_ids (uuid[]?)      │
│ token_count (int)           │
│ model_used (text?)          │
│ created_at (timestamp)      │
└─────────────────────────────┘

┌─────────────────────────────┐
│  ai_documents               │
│─────────────────────────────│
│ id (uuid, PK)               │
│ conversation_id (uuid, FK)  │
│ message_id (uuid, FK?)      │
│ tenant_id (uuid, FK)        │
│ user_id (uuid, FK)          │
│ file_name (text)            │
│ file_type (text)            │
│ file_size (int)             │
│ storage_path (text)         │
│ extracted_text (text?)      │
│ processing_status (enum)    │
│ processing_error (text?)    │
│ created_at (timestamp)      │
└─────────────────────────────┘

┌─────────────────────────────┐
│  ai_tasks                   │
│─────────────────────────────│
│ id (uuid, PK)               │
│ conversation_id (uuid, FK)  │
│ message_id (uuid, FK)       │
│ tenant_id (uuid, FK)        │
│ user_id (uuid, FK)          │
│ task_type (enum)            │
│ generated_data (jsonb)      │
│ approval_status (enum)      │
│ executed_at (timestamp?)    │
│ result_id (uuid?)           │
│ created_at (timestamp)      │
└─────────────────────────────┘

┌─────────────────────────────┐
│  ai_usage_records           │
│─────────────────────────────│
│ id (uuid, PK)               │
│ tenant_id (uuid, FK)        │
│ user_id (uuid, FK)          │
│ action_type (enum)          │
│ conversation_id (uuid, FK?) │
│ tokens_used (int)           │
│ model_used (text)           │
│ cost_estimate (decimal?)    │
│ created_at (timestamp)      │
└─────────────────────────────┘

┌─────────────────────────────┐
│  ai_audit_logs              │
│─────────────────────────────│
│ id (uuid, PK)               │
│ tenant_id (uuid, FK)        │
│ user_id (uuid, FK)          │
│ conversation_id (uuid, FK?) │
│ action (text)               │
│ prompt (text?)              │
│ response (text?)            │
│ data_accessed (jsonb?)      │
│ permissions (text[])        │
│ ip_address (inet?)          │
│ user_agent (text?)          │
│ created_at (timestamp)      │
└─────────────────────────────┘

┌─────────────────────────────┐
│  ai_configurations          │
│─────────────────────────────│
│ id (uuid, PK)               │
│ tenant_id (uuid, FK, NULL)  │
│ config_key (text)           │
│ config_value (jsonb)        │
│ created_at (timestamp)      │
│ updated_at (timestamp)      │
└─────────────────────────────┘
```

## Entity Definitions

### 1. ai_conversations

Represents a conversation thread between a user and the AI agent.

**Fields**:
- `id` (uuid, PK): Unique conversation identifier
- `tenant_id` (uuid, FK → tenants.id, NOT NULL): Multi-tenant isolation
- `user_id` (uuid, FK → users.id, NOT NULL): Conversation owner
- `title` (text): Auto-generated or user-set conversation title (e.g., "Sales inquiry - Dec 26")
- `consultant_role` (enum: 'general' | 'marketing' | 'legal' | 'customer_service' | 'financial_analyst'): Active consultant mode
- `status` (enum: 'active' | 'archived'): Conversation state
- `created_at` (timestamp with time zone, NOT NULL, default NOW())
- `updated_at` (timestamp with time zone, NOT NULL, default NOW())
- `deleted_at` (timestamp with time zone, NULLABLE): Soft delete for 90-day retention

**Indexes**:
- PRIMARY KEY (id)
- INDEX (tenant_id, user_id, deleted_at) - Query active conversations by user
- INDEX (created_at) - Cleanup job performance
- INDEX (updated_at) - Sort by recent activity

**Validation Rules**:
- `consultant_role` must be one of the 5 defined roles (FR-038)
- `deleted_at` if set, must be >= created_at

**Business Rules**:
- New conversations default to 'general' consultant role
- Title auto-generated from first user message (truncated to 50 chars)
- Soft-deleted after 90 days (A-006)

---

### 2. ai_messages

Individual messages within a conversation (user questions, AI responses).

**Fields**:
- `id` (uuid, PK): Unique message identifier
- `conversation_id` (uuid, FK → ai_conversations.id, NOT NULL, ON DELETE CASCADE): Parent conversation
- `role` (enum: 'user' | 'assistant' | 'system'): Message speaker
- `content` (text, NOT NULL): Message text content
- `document_ids` (uuid[], NULLABLE): References to attached documents
- `token_count` (int, NOT NULL, default 0): Tokens consumed by this message
- `model_used` (text, NULLABLE): Model identifier (e.g., "claude-sonnet-4-5")
- `created_at` (timestamp with time zone, NOT NULL, default NOW())

**Indexes**:
- PRIMARY KEY (id)
- INDEX (conversation_id, created_at) - Fetch messages in order
- INDEX (role) - Filter by speaker

**Validation Rules**:
- `content` max length: 100,000 characters (prevents abuse)
- `role` must be 'user', 'assistant', or 'system'
- `token_count` >= 0

**Business Rules**:
- System messages used for context summaries (NFR-004 sliding window)
- Token count populated from AI SDK response metadata
- Messages not deleted when conversation soft-deleted (audit trail)

---

### 3. ai_documents

Uploaded files (images, PDFs) associated with messages.

**Fields**:
- `id` (uuid, PK): Unique document identifier
- `conversation_id` (uuid, FK → ai_conversations.id, NOT NULL, ON DELETE CASCADE): Parent conversation
- `message_id` (uuid, FK → ai_messages.id, NULLABLE): Associated message (if attached to specific message)
- `tenant_id` (uuid, FK → tenants.id, NOT NULL): Multi-tenant isolation
- `user_id` (uuid, FK → users.id, NOT NULL): Uploader
- `file_name` (text, NOT NULL): Original filename
- `file_type` (text, NOT NULL): MIME type (e.g., "application/pdf", "image/png")
- `file_size` (int, NOT NULL): File size in bytes
- `storage_path` (text, NOT NULL): Supabase Storage path (e.g., "ai-documents/{tenant_id}/{id}")
- `extracted_text` (text, NULLABLE): Extracted text content (for PDFs)
- `processing_status` (enum: 'pending' | 'processing' | 'completed' | 'failed'): Processing state
- `processing_error` (text, NULLABLE): Error message if processing failed
- `created_at` (timestamp with time zone, NOT NULL, default NOW())

**Indexes**:
- PRIMARY KEY (id)
- INDEX (conversation_id) - Fetch all documents in conversation
- INDEX (tenant_id, user_id) - Usage tracking per user
- INDEX (processing_status) - Find pending documents for batch processing

**Validation Rules**:
- `file_type` must be in allowed list: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
- `file_size` <= 10MB (A-008)
- `storage_path` must start with "ai-documents/"

**Business Rules**:
- Files stored in Supabase Storage with tenant isolation
- Processing triggered asynchronously after upload (FR-017)
- Free tier: 3 documents/month, Premium: 100/month (FR-019, FR-020)

---

### 4. ai_tasks

AI-generated transactions awaiting user approval.

**Fields**:
- `id` (uuid, PK): Unique task identifier
- `conversation_id` (uuid, FK → ai_conversations.id, NOT NULL, ON DELETE CASCADE): Source conversation
- `message_id` (uuid, FK → ai_messages.id, NOT NULL): AI message that generated the task
- `tenant_id` (uuid, FK → tenants.id, NOT NULL): Multi-tenant isolation
- `user_id` (uuid, FK → users.id, NOT NULL): Task owner
- `task_type` (enum: 'invoice' | 'purchase_order' | 'sales_order' | 'payment' | 'journal_entry'): Transaction type
- `generated_data` (jsonb, NOT NULL): AI-generated transaction data (schema varies by type)
- `approval_status` (enum: 'pending' | 'approved' | 'rejected' | 'executed'): Approval state
- `executed_at` (timestamp with time zone, NULLABLE): When task was committed to database
- `result_id` (uuid, NULLABLE): ID of created transaction (e.g., invoice.id)
- `created_at` (timestamp with time zone, NOT NULL, default NOW())

**Indexes**:
- PRIMARY KEY (id)
- INDEX (tenant_id, user_id, approval_status) - Fetch pending tasks
- INDEX (conversation_id) - Link tasks to conversations

**Validation Rules**:
- `generated_data` must conform to transaction schema (validated by Zod schemas)
- `approval_status` transitions: pending → approved → executed, or pending → rejected
- `executed_at` must be NULL if approval_status != 'executed'

**Business Rules**:
- Tasks require explicit user approval (FR-011)
- User navigates to transaction form pre-filled with AI data (FR-012)
- Free tier: 5 tasks/month, Premium: unlimited (FR-019, FR-020)
- All tasks marked with AI-generated flag (FR-013)

**Example generated_data (invoice)**:
```json
{
  "type": "sales_invoice",
  "party_id": "uuid",
  "items": [
    { "item_id": "uuid", "quantity": 5, "unit_price": 100 }
  ],
  "notes": "AI-generated invoice for customer ABC"
}
```

---

### 5. ai_usage_records

Tracks usage metrics for tier enforcement and billing.

**Fields**:
- `id` (uuid, PK): Unique record identifier
- `tenant_id` (uuid, FK → tenants.id, NOT NULL): Multi-tenant isolation
- `user_id` (uuid, FK → users.id, NOT NULL): User who performed action
- `action_type` (enum: 'question' | 'document' | 'task'): Type of usage
- `conversation_id` (uuid, FK → ai_conversations.id, NULLABLE): Associated conversation
- `tokens_used` (int, NOT NULL, default 0): Tokens consumed
- `model_used` (text, NOT NULL): Model identifier
- `cost_estimate` (decimal(10,4), NULLABLE): Estimated cost in USD (for billing)
- `created_at` (timestamp with time zone, NOT NULL, default NOW())

**Indexes**:
- PRIMARY KEY (id)
- INDEX (tenant_id, created_at) - Aggregate usage by tenant
- INDEX (user_id, created_at, action_type) - Check daily/monthly limits
- INDEX (created_at) - Time-series queries for analytics

**Validation Rules**:
- `tokens_used` >= 0
- `cost_estimate` >= 0 if set
- `action_type` must be 'question', 'document', or 'task'

**Business Rules**:
- Record created for every AI interaction (FR-021)
- Daily aggregation: COUNT(*) WHERE action_type='question' AND created_at >= CURRENT_DATE
- Monthly aggregation: COUNT(*) WHERE action_type='document' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
- Cost estimates based on provider pricing (Claude: $3/1M input tokens, $15/1M output)

---

### 6. ai_audit_logs

Permanent audit trail of all AI interactions (FR-007).

**Fields**:
- `id` (uuid, PK): Unique log identifier
- `tenant_id` (uuid, FK → tenants.id, NOT NULL): Multi-tenant isolation
- `user_id` (uuid, FK → users.id, NOT NULL): User who performed action
- `conversation_id` (uuid, FK → ai_conversations.id, NULLABLE): Associated conversation
- `action` (text, NOT NULL): Action performed (e.g., "ask_question", "upload_document", "approve_task")
- `prompt` (text, NULLABLE): User's prompt (if applicable)
- `response` (text, NULLABLE): AI's response (truncated if > 10KB)
- `data_accessed` (jsonb, NULLABLE): Summary of data queried (table names, IDs)
- `permissions` (text[], NULLABLE): User's permissions at time of action
- `ip_address` (inet, NULLABLE): Client IP address
- `user_agent` (text, NULLABLE): Client user agent
- `created_at` (timestamp with time zone, NOT NULL, default NOW())

**Indexes**:
- PRIMARY KEY (id)
- INDEX (tenant_id, created_at DESC) - Admin dashboard queries
- INDEX (user_id, created_at DESC) - User-specific audit trail
- INDEX (conversation_id) - Link to conversations

**Validation Rules**:
- `action` must be non-empty
- `response` max length: 10,000 characters (larger responses truncated with "...")

**Business Rules**:
- Logs retained permanently (never deleted, even after 90-day conversation cleanup)
- Logs include permission context (FR-006 compliance verification)
- Sensitive data (passwords, API keys) never logged (FR-008)
- Logs used for compliance, debugging, and security audits

---

### 7. ai_configurations

System-wide and tenant-specific AI settings.

**Fields**:
- `id` (uuid, PK): Unique config identifier
- `tenant_id` (uuid, FK → tenants.id, NULLABLE): NULL for system-wide, tenant ID for tenant-specific
- `config_key` (text, NOT NULL): Configuration key (e.g., "default_model", "enabled_features")
- `config_value` (jsonb, NOT NULL): Configuration value
- `created_at` (timestamp with time zone, NOT NULL, default NOW())
- `updated_at` (timestamp with time zone, NOT NULL, default NOW())

**Indexes**:
- PRIMARY KEY (id)
- UNIQUE INDEX (tenant_id, config_key) - One config per key per tenant
- INDEX (config_key) - Fetch by key

**Validation Rules**:
- `config_key` must match pattern: ^[a-z_]+$ (lowercase, underscores only)
- `config_value` must be valid JSON

**Business Rules**:
- System configs (tenant_id = NULL) set defaults (FR-029)
- Tenant configs override system defaults
- SaaS admins manage system configs (FR-027, FR-030)

**Example configurations**:
```json
// System-wide (tenant_id = NULL)
{
  "config_key": "default_model",
  "config_value": { "provider": "anthropic", "model": "claude-sonnet-4-5" }
}

// Tenant-specific
{
  "config_key": "enabled_roles",
  "config_value": ["general", "marketing", "financial_analyst"]
}

// Global rate limits
{
  "config_key": "rate_limits",
  "config_value": { "questions_per_minute": 10, "questions_per_day_free": 25 }
}
```

---

## Enums

### consultant_role
```sql
CREATE TYPE consultant_role AS ENUM (
  'general',
  'marketing',
  'legal',
  'customer_service',
  'financial_analyst'
);
```

### conversation_status
```sql
CREATE TYPE conversation_status AS ENUM (
  'active',
  'archived'
);
```

### message_role
```sql
CREATE TYPE message_role AS ENUM (
  'user',
  'assistant',
  'system'
);
```

### processing_status
```sql
CREATE TYPE processing_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);
```

### task_type
```sql
CREATE TYPE task_type AS ENUM (
  'invoice',
  'purchase_order',
  'sales_order',
  'payment',
  'journal_entry'
);
```

### approval_status
```sql
CREATE TYPE approval_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'executed'
);
```

### usage_action_type
```sql
CREATE TYPE usage_action_type AS ENUM (
  'question',
  'document',
  'task'
);
```

---

## Row-Level Security (RLS) Policies

All tables follow the existing ERP system's RLS pattern:

### ai_conversations
```sql
-- Users can only see their own conversations within their tenant
CREATE POLICY "Users can view own conversations"
  ON ai_conversations FOR SELECT
  USING (tenant_id = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid());

-- Users can create conversations in their tenant
CREATE POLICY "Users can create conversations"
  ON ai_conversations FOR INSERT
  WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid());

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
  ON ai_conversations FOR UPDATE
  USING (tenant_id = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid());
```

### ai_messages
```sql
-- Users can view messages in their conversations
CREATE POLICY "Users can view messages in own conversations"
  ON ai_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM ai_conversations
      WHERE tenant_id = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid()
    )
  );

-- Users can insert messages in their conversations
CREATE POLICY "Users can create messages in own conversations"
  ON ai_messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM ai_conversations
      WHERE tenant_id = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid()
    )
  );
```

### ai_documents
```sql
-- Users can view their own documents within their tenant
CREATE POLICY "Users can view own documents"
  ON ai_documents FOR SELECT
  USING (tenant_id = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid());

CREATE POLICY "Users can upload documents"
  ON ai_documents FOR INSERT
  WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid());
```

### ai_tasks
```sql
-- Users can view their own tasks
CREATE POLICY "Users can view own tasks"
  ON ai_tasks FOR SELECT
  USING (tenant_id = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid());

-- Users can update their own tasks (approval workflow)
CREATE POLICY "Users can update own tasks"
  ON ai_tasks FOR UPDATE
  USING (tenant_id = auth.jwt() ->> 'tenant_id' AND user_id = auth.uid());
```

### ai_usage_records
```sql
-- Users can view their own usage stats
CREATE POLICY "Users can view own usage"
  ON ai_usage_records FOR SELECT
  USING (user_id = auth.uid());

-- Service role can insert usage records
CREATE POLICY "Service can insert usage records"
  ON ai_usage_records FOR INSERT
  WITH CHECK (true);  -- Controlled by service role key
```

### ai_audit_logs
```sql
-- Admin users can view all audit logs in their tenant
CREATE POLICY "Admins can view tenant audit logs"
  ON ai_audit_logs FOR SELECT
  USING (
    tenant_id = auth.jwt() ->> 'tenant_id'
    AND has_permission(auth.uid(), 'audit:read')
  );

-- Service role can insert audit logs
CREATE POLICY "Service can insert audit logs"
  ON ai_audit_logs FOR INSERT
  WITH CHECK (true);  -- Controlled by service role key
```

### ai_configurations
```sql
-- All users can read configs for their tenant
CREATE POLICY "Users can read tenant configs"
  ON ai_configurations FOR SELECT
  USING (tenant_id = auth.jwt() ->> 'tenant_id' OR tenant_id IS NULL);

-- Only admins can modify configs
CREATE POLICY "Admins can modify tenant configs"
  ON ai_configurations FOR ALL
  USING (
    tenant_id = auth.jwt() ->> 'tenant_id'
    AND has_permission(auth.uid(), 'settings:write')
  );

-- SaaS admins can modify system configs
CREATE POLICY "SaaS admins can modify system configs"
  ON ai_configurations FOR ALL
  USING (
    tenant_id IS NULL
    AND has_permission(auth.uid(), 'saas_admin')
  );
```

---

## Database Functions

### 1. Cleanup Old Conversations

```sql
CREATE OR REPLACE FUNCTION cleanup_old_ai_conversations()
RETURNS void AS $$
BEGIN
  UPDATE ai_conversations
  SET deleted_at = NOW()
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Get Usage Stats for User

```sql
CREATE OR REPLACE FUNCTION get_user_ai_usage(
  p_user_id UUID,
  p_period TEXT DEFAULT 'today'  -- 'today', 'month'
)
RETURNS TABLE (
  questions INT,
  documents INT,
  tasks INT
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
    COUNT(*) FILTER (WHERE action_type = 'question')::INT AS questions,
    COUNT(*) FILTER (WHERE action_type = 'document')::INT AS documents,
    COUNT(*) FILTER (WHERE action_type = 'task')::INT AS tasks
  FROM ai_usage_records
  WHERE user_id = p_user_id
    AND created_at >= start_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Check Tier Limits

```sql
CREATE OR REPLACE FUNCTION check_ai_tier_limit(
  p_user_id UUID,
  p_action_type usage_action_type
)
RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
  usage_count INT;
  limit_value INT;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO user_tier
  FROM users
  WHERE id = p_user_id;

  -- Get usage count for today/month based on action type
  IF p_action_type = 'question' THEN
    SELECT COUNT(*) INTO usage_count
    FROM ai_usage_records
    WHERE user_id = p_user_id
      AND action_type = 'question'
      AND created_at >= CURRENT_DATE;

    limit_value := CASE user_tier
      WHEN 'free' THEN 25
      ELSE 999999  -- Unlimited for premium
    END;
  ELSIF p_action_type = 'document' THEN
    SELECT COUNT(*) INTO usage_count
    FROM ai_usage_records
    WHERE user_id = p_user_id
      AND action_type = 'document'
      AND created_at >= DATE_TRUNC('month', CURRENT_DATE);

    limit_value := CASE user_tier
      WHEN 'free' THEN 3
      ELSE 100  -- Premium limit
    END;
  ELSIF p_action_type = 'task' THEN
    SELECT COUNT(*) INTO usage_count
    FROM ai_usage_records
    WHERE user_id = p_user_id
      AND action_type = 'task'
      AND created_at >= DATE_TRUNC('month', CURRENT_DATE);

    limit_value := CASE user_tier
      WHEN 'free' THEN 5
      ELSE 999999  -- Unlimited for premium
    END;
  END IF;

  RETURN usage_count < limit_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Migration Strategy

This schema will be implemented in `packages/database/migrations/013_ai_agent_schema.sql` using Supabase MCP tools:

1. Create enums
2. Create tables in dependency order
3. Add indexes
4. Create RLS policies
5. Create database functions
6. Set up pg_cron job for cleanup
7. Insert default system configurations

**Dependencies**:
- Existing `tenants` table
- Existing `users` table with `subscription_tier` column
- Existing `has_permission()` function for RLS
- Supabase Storage bucket for document uploads

---

## Data Retention Summary

| Entity | Retention Policy |
|--------|------------------|
| ai_conversations | 90 days (soft delete) |
| ai_messages | Permanent (tied to conversations via FK, not deleted on soft-delete) |
| ai_documents | 90 days (deleted with conversation) |
| ai_tasks | Permanent (audit trail) |
| ai_usage_records | Aggregated then deleted after 1 year |
| ai_audit_logs | Permanent |
| ai_configurations | Permanent (until manually deleted) |

---

## Data Size Estimates

Based on 1,000 active users, 50% AI adoption:

- **ai_conversations**: ~500 active, ~5,000/month → 60,000/year (before cleanup)
- **ai_messages**: ~20 messages/conversation → 1.2M/year
- **ai_documents**: ~1 document/10 conversations → 6,000/year
- **ai_tasks**: ~1 task/20 conversations → 3,000/year
- **ai_usage_records**: ~10 records/conversation → 600,000/year
- **ai_audit_logs**: ~1 log/message → 1.2M/year

**Estimated annual storage**: ~2GB (text data) + 30GB (documents in Supabase Storage)

---

## Next Steps

1. Generate API contracts (OpenAPI spec) based on these entities
2. Define Zod validation schemas in `packages/shared/src/validation/ai.ts`
3. Create TypeScript types in `packages/shared/src/types/ai.ts`
4. Implement migration file `013_ai_agent_schema.sql`
