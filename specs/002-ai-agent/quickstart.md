# Quickstart Guide: AI Agent Assistant

**Feature**: AI Agent Assistant
**Date**: 2025-12-26
**Audience**: Developers implementing this feature

## Overview

This quickstart guide provides step-by-step instructions for implementing the AI Agent Assistant feature. Follow these steps in order to build the complete feature from database schema to UI components.

## Prerequisites

- [ ] Completed Phase 0 research (see `research.md`)
- [ ] Reviewed data model (see `data-model.md`)
- [ ] Reviewed API contracts (see `contracts/`)
- [ ] Environment variables configured (see below)
- [ ] Anthropic and/or Google AI API keys obtained

## Implementation Phases

### Phase 1: Database Setup (Est. 2-4 hours)

#### 1.1 Create Migration File

Create `packages/database/migrations/013_ai_agent_schema.sql`:

```bash
# Use Supabase MCP for migration
mcp__supabase__apply_migration --migration-file 013_ai_agent_schema.sql
```

**Migration Contents** (from `data-model.md`):
- [ ] Create enums (consultant_role, conversation_status, etc.)
- [ ] Create tables (ai_conversations, ai_messages, etc.)
- [ ] Add indexes for performance
- [ ] Create RLS policies for multi-tenant security
- [ ] Create database functions (cleanup, usage stats, tier limits)
- [ ] Set up pg_cron job for 90-day cleanup
- [ ] Insert default system configurations

#### 1.2 Generate TypeScript Types

```bash
mcp__supabase__generate_typescript_types --output packages/database/src/types.ts
```

#### 1.3 Verify Schema

```bash
mcp__supabase__list_tables --filter "ai_*"
```

Expected output: 7 new tables (ai_conversations, ai_messages, ai_documents, ai_tasks, ai_usage_records, ai_audit_logs, ai_configurations)

---

### Phase 2: Shared Types and Validation (Est. 1-2 hours)

#### 2.1 Create TypeScript Types

File: `packages/shared/src/types/ai.ts`

```typescript
export type ConsultantRole = 'general' | 'marketing' | 'legal' | 'customer_service' | 'financial_analyst';

export interface Conversation {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  consultant_role: ConsultantRole;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  document_ids?: string[];
  token_count: number;
  model_used?: string;
  created_at: string;
}

// Add more types from data-model.md...
```

#### 2.2 Create Zod Validation Schemas

File: `packages/shared/src/validation/ai.ts`

```typescript
import { z } from 'zod';

export const consultantRoleSchema = z.enum([
  'general',
  'marketing',
  'legal',
  'customer_service',
  'financial_analyst'
]);

export const createConversationSchema = z.object({
  title: z.string().max(100).optional(),
  consultant_role: consultantRoleSchema.default('general'),
  initial_message: z.string().max(10000).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  document_ids: z.array(z.string().uuid()).optional(),
});

// Add more schemas from API contracts...
```

#### 2.3 Update Package Exports

File: `packages/shared/src/types/index.ts`:
```typescript
export * from './ai';
export * from './ai-models';
```

File: `packages/shared/src/validation/index.ts`:
```typescript
export * from './ai';
```

---

### Phase 3: Backend - AI Model Integration (Est. 3-4 hours)

#### 3.1 Install Dependencies

File: `apps/api/package.json`:
```json
{
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/google": "^1.0.0",
    "pdf-parse": "^1.1.1"
  }
}
```

```bash
cd apps/api && pnpm install
```

#### 3.2 Create Model Factory

File: `apps/api/src/lib/ai-models/model-factory.ts`

(See `contracts/ai-models.md` for complete implementation)

```typescript
import { LanguageModel } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export class ModelFactory {
  static getDefaultModel(): LanguageModel {
    const provider = process.env.AI_DEFAULT_PROVIDER || 'anthropic';
    const model = process.env.AI_DEFAULT_MODEL || 'claude-sonnet-4-5';
    return provider === 'anthropic' ? anthropic(model) : google(model);
  }

  static getSummaryModel(): LanguageModel {
    const model = process.env.AI_SUMMARY_MODEL || 'claude-haiku-4';
    return anthropic(model);
  }
}
```

#### 3.3 Create Context Manager

File: `apps/api/src/lib/context-manager.ts`

(See `research.md` for implementation details)

```typescript
import { generateText } from 'ai';
import { ModelFactory } from './ai-models/model-factory';

export class ConversationContextManager {
  private readonly MAX_RECENT_MESSAGES = 20;

  async prepareContext(messages: Message[]): Promise<Message[]> {
    if (messages.length <= this.MAX_RECENT_MESSAGES) {
      return messages;
    }

    const recent = messages.slice(-this.MAX_RECENT_MESSAGES);
    const older = messages.slice(0, -this.MAX_RECENT_MESSAGES);
    const summary = await this.summarizeMessages(older);

    return [
      { role: 'system', content: `Previous conversation summary: ${summary}` },
      ...recent
    ];
  }

  private async summarizeMessages(messages: Message[]): Promise<string> {
    const { text } = await generateText({
      model: ModelFactory.getSummaryModel(),
      prompt: `Summarize this conversation concisely: ${JSON.stringify(messages)}`
    });
    return text;
  }
}
```

---

### Phase 4: Backend - Repositories (Est. 2-3 hours)

#### 4.1 Create AI Repositories

Files to create:
- `apps/api/src/repositories/ai-conversation.repository.ts`
- `apps/api/src/repositories/ai-message.repository.ts`
- `apps/api/src/repositories/ai-usage.repository.ts`
- `apps/api/src/repositories/ai-task.repository.ts`

Example (Conversation Repository):

```typescript
import { Database } from '@erp-saas/database';
import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.repository';

export class AIConversationRepository extends BaseRepository {
  async create(data: {
    tenant_id: string;
    user_id: string;
    title: string;
    consultant_role: string;
  }) {
    const { data: conversation, error } = await this.supabase
      .from('ai_conversations')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return conversation;
  }

  async findByUser(userId: string, status?: string) {
    let query = this.supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Add more methods...
}
```

---

### Phase 5: Backend - Services (Est. 4-6 hours)

#### 5.1 Create AI Services

Files to create:
- `apps/api/src/services/ai-agent.service.ts` - Core AI orchestration
- `apps/api/src/services/ai-conversation.service.ts` - Conversation management
- `apps/api/src/services/ai-usage.service.ts` - Usage tracking
- `apps/api/src/services/ai-document.service.ts` - Document processing

Example (AI Agent Service):

```typescript
import { streamText, generateText } from 'ai';
import { ModelFactory } from '../lib/ai-models/model-factory';
import { ConversationContextManager } from '../lib/context-manager';
import { AIMessageRepository } from '../repositories/ai-message.repository';

export class AIAgentService {
  constructor(
    private messageRepo: AIMessageRepository,
    private contextManager: ConversationContextManager
  ) {}

  async processMessage(conversationId: string, userMessage: string) {
    // 1. Save user message
    const savedMessage = await this.messageRepo.create({
      conversation_id: conversationId,
      role: 'user',
      content: userMessage,
      token_count: 0  // Will update after AI response
    });

    // 2. Get conversation history
    const messages = await this.messageRepo.findByConversation(conversationId);

    // 3. Prepare context (sliding window)
    const contextMessages = await this.contextManager.prepareContext(messages);

    // 4. Stream AI response
    const result = await streamText({
      model: ModelFactory.getDefaultModel(),
      messages: contextMessages.map(m => ({
        role: m.role,
        content: m.content
      })),
      system: this.buildSystemPrompt(user)
    });

    return result;
  }

  private buildSystemPrompt(user: User): string {
    return `You are an AI assistant for an ERP system...
    User: ${user.name}
    Tenant: ${user.tenant_id}
    Permissions: ${user.permissions.join(', ')}`;
  }
}
```

---

### Phase 6: Backend - Routes (Est. 2-3 hours)

#### 6.1 Create AI Routes

Files to create:
- `apps/api/src/routes/ai-conversations.routes.ts`
- `apps/api/src/routes/ai-admin.routes.ts`
- `apps/api/src/routes/ai-tasks.routes.ts`

Example (Conversations Routes):

```typescript
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { aiQuestionRateLimit } from '../middleware/ai-rate-limit';
import { createConversationSchema, sendMessageSchema } from '@erp-saas/shared';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// GET /api/ai/conversations
router.get('/', async (req, res) => {
  const conversations = await conversationService.listByUser(req.user!.id);
  res.json({ conversations });
});

// POST /api/ai/conversations
router.post(
  '/',
  validateRequest(createConversationSchema),
  async (req, res) => {
    const conversation = await conversationService.create(
      req.user!.id,
      req.user!.tenant_id,
      req.body
    );
    res.status(201).json(conversation);
  }
);

// POST /api/ai/conversations/:id/messages (streaming)
router.post(
  '/:id/messages',
  aiQuestionRateLimit,  // Rate limit AI requests
  validateRequest(sendMessageSchema),
  async (req, res) => {
    // Check usage limits
    const canProceed = await usageService.checkLimit(
      req.user!.id,
      'question'
    );

    if (!canProceed) {
      return res.status(403).json({
        error: 'Daily question limit reached',
        code: 'USAGE_LIMIT_EXCEEDED'
      });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream AI response
    const result = await aiAgentService.processMessage(
      req.params.id,
      req.body.content
    );

    for await (const chunk of result.textStream) {
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
    }

    const usage = await result.usage;
    res.write(`data: ${JSON.stringify({ type: 'done', usage })}\n\n`);
    res.end();
  }
);

export default router;
```

#### 6.2 Register Routes in Main App

File: `apps/api/src/index.ts`:

```typescript
import aiConversationRoutes from './routes/ai-conversations.routes';
import aiAdminRoutes from './routes/ai-admin.routes';
import aiTaskRoutes from './routes/ai-tasks.routes';

// After existing routes
app.use('/api/ai/conversations', aiConversationRoutes);
app.use('/api/ai/admin', aiAdminRoutes);
app.use('/api/ai/tasks', aiTaskRoutes);
```

---

### Phase 7: Frontend - UI Components (Est. 6-8 hours)

#### 7.1 Create AI Panel Components

Files to create:
- `apps/web/src/components/ai/ai-panel.tsx` - Main panel container
- `apps/web/src/components/ai/chat-interface.tsx` - Message display
- `apps/web/src/components/ai/role-selector.tsx` - Consultant role picker
- `apps/web/src/components/ai/usage-indicator.tsx` - Usage stats
- `apps/web/src/components/ai/document-upload.tsx` - File upload

Example (AI Panel):

```tsx
'use client';

import { useState } from 'react';
import { useAIPanelStore } from '@/stores/ai-panel-store';
import { ChatInterface } from './chat-interface';
import { RoleSelector } from './role-selector';
import { UsageIndicator } from './usage-indicator';
import { Button } from '@/components/ui/button';
import { X, MessageSquare } from 'lucide-react';

export function AIPanel() {
  const { isOpen, toggle, close } = useAIPanelStore();

  if (!isOpen) {
    return (
      <Button
        onClick={toggle}
        className="fixed bottom-4 right-4 rounded-full shadow-lg"
        size="lg"
      >
        <MessageSquare className="w-5 h-5 mr-2" />
        AI Assistant
      </Button>
    );
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl border-l border-gray-200 flex flex-col z-50 rtl:right-auto rtl:left-0 rtl:border-r rtl:border-l-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">AI Assistant</h2>
        <Button variant="ghost" size="sm" onClick={close}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Role Selector */}
      <div className="p-4 border-b">
        <RoleSelector />
      </div>

      {/* Chat Interface (main content) */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>

      {/* Usage Indicator */}
      <div className="p-4 border-t">
        <UsageIndicator />
      </div>
    </div>
  );
}
```

#### 7.2 Create Zustand Store

File: `apps/web/src/stores/ai-panel-store.ts`:

```typescript
import { create } from 'zustand';

interface AIPanelState {
  isOpen: boolean;
  currentConversationId: string | null;
  toggle: () => void;
  open: () => void;
  close: () => void;
  setConversation: (id: string) => void;
}

export const useAIPanelStore = create<AIPanelState>((set) => ({
  isOpen: false,
  currentConversationId: null,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setConversation: (id) => set({ currentConversationId: id }),
}));
```

#### 7.3 Create TanStack Query Hooks

File: `apps/web/src/hooks/use-ai-conversation.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useConversations() {
  return useQuery({
    queryKey: ['ai', 'conversations'],
    queryFn: () => apiClient.get('/api/ai/conversations').then(r => r.data.conversations),
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { consultant_role?: string; initial_message?: string }) =>
      apiClient.post('/api/ai/conversations', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai', 'conversations'] });
    },
  });
}

export function useSendMessage(conversationId: string) {
  return useMutation({
    mutationFn: (content: string) =>
      apiClient.post(`/api/ai/conversations/${conversationId}/messages`, { content }),
  });
}
```

---

### Phase 8: Frontend - Integration (Est. 2-3 hours)

#### 8.1 Add AI Panel to Layout

File: `apps/web/src/components/layout/index.tsx`:

```tsx
import { AIPanel } from '@/components/ai/ai-panel';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header />
        {children}
      </main>
      <AIPanel />  {/* Add AI panel */}
    </div>
  );
}
```

#### 8.2 Add Localization Keys

Files: `apps/web/src/locales/en/common.json` and `apps/web/src/locales/ar/common.json`:

```json
{
  "ai": {
    "title": "AI Assistant",
    "roles": {
      "general": "General Assistant",
      "marketing": "Marketing Consultant",
      "legal": "Legal Consultant",
      "customer_service": "Customer Service",
      "financial_analyst": "Financial Analyst"
    },
    "usage": {
      "questions": "Questions",
      "documents": "Documents",
      "tasks": "Tasks",
      "remaining": "remaining"
    },
    "errors": {
      "limit_exceeded": "Usage limit reached. Please upgrade.",
      "service_unavailable": "AI service unavailable. Retrying..."
    }
  }
}
```

---

### Phase 9: Testing (Est. 4-6 hours)

#### 9.1 Backend Unit Tests

File: `apps/api/tests/unit/ai-agent.service.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { AIAgentService } from '../../src/services/ai-agent.service';
import { MockAIModel } from '../mocks/mock-ai-model';

describe('AIAgentService', () => {
  it('should process user message and return AI response', async () => {
    const service = new AIAgentService(mockMessageRepo, mockContextManager);

    const result = await service.processMessage('conv-123', 'What were my sales?');

    expect(result).toBeDefined();
    expect(result.textStream).toBeDefined();
  });

  it('should enforce usage limits', async () => {
    // Test free tier limit (25 questions/day)
    // ...
  });
});
```

#### 9.2 Frontend Component Tests

File: `apps/web/tests/components/ai-panel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { AIPanel } from '@/components/ai/ai-panel';

describe('AIPanel', () => {
  it('renders toggle button when closed', () => {
    render(<AIPanel />);
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });

  it('renders panel when opened', () => {
    // ...
  });
});
```

#### 9.3 E2E Tests with Chrome DevTools MCP

```typescript
// Test AI conversation flow
mcp__chrome-devtools__navigate_page({ url: 'http://localhost:3000/dashboard' });
mcp__chrome-devtools__click({ selector: '[data-testid="ai-panel-toggle"]' });
mcp__chrome-devtools__fill({ selector: '[data-testid="ai-message-input"]', value: 'Test question' });
mcp__chrome-devtools__click({ selector: '[data-testid="ai-send-button"]' });
mcp__chrome-devtools__take_snapshot(); // Verify response appears
```

---

### Phase 10: Deployment Preparation (Est. 1-2 hours)

#### 10.1 Environment Variables Checklist

```bash
# Backend (.env)
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIzaSy...
AI_DEFAULT_PROVIDER=anthropic
AI_DEFAULT_MODEL=claude-sonnet-4-5
AI_SUMMARY_MODEL=claude-haiku-4

# Supabase (already configured)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

#### 10.2 Database Migration

```bash
# Apply migration to production
mcp__supabase__apply_migration --environment production --migration-file 013_ai_agent_schema.sql
```

#### 10.3 Verify RLS Policies

```bash
# Test RLS policies prevent cross-tenant data access
mcp__supabase__list_policies --table ai_conversations
```

---

## Development Workflow

### 1. Start Development Servers

```bash
# Terminal 1: API server
cd apps/api
pnpm dev

# Terminal 2: Web server
cd apps/web
pnpm dev
```

### 2. Test AI Integration

```bash
# Open browser
http://localhost:3000/dashboard

# Click "AI Assistant" button
# Send test message: "What were my total sales last month?"
# Verify streaming response appears
```

### 3. Monitor Logs

```bash
# API logs
tail -f apps/api/logs/app.log

# Supabase logs
mcp__supabase__logs --type api --limit 100
```

---

## Common Issues and Solutions

### Issue: "ANTHROPIC_API_KEY is not defined"

**Solution**: Ensure `.env` file exists in `apps/api/` with API key:
```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." >> apps/api/.env
```

### Issue: Streaming response not working

**Solution**: Check SSE headers are set correctly:
```typescript
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
```

### Issue: RLS policy blocking queries

**Solution**: Verify JWT token includes `tenant_id` claim:
```typescript
const { data: { user } } = await supabase.auth.getUser();
console.log(user?.user_metadata?.tenant_id);
```

### Issue: Usage limits not enforcing

**Solution**: Check database function exists:
```sql
SELECT check_ai_tier_limit('user-id', 'question');
```

---

## Next Steps

After completing this quickstart:

1. ✅ Run full test suite: `pnpm test`
2. ✅ Test all 5 user stories from `spec.md`
3. ✅ Verify subscription tier limits (free vs premium)
4. ✅ Test document upload and processing
5. ✅ Test multi-language support (English + Arabic)
6. ✅ Review security (RLS policies, permission checks)
7. ✅ Performance testing (100 concurrent conversations)
8. ✅ Cost monitoring (track token usage and API costs)

## Reference Documents

- **Feature Spec**: `spec.md` - Requirements and user stories
- **Research**: `research.md` - Technology decisions
- **Data Model**: `data-model.md` - Database schema
- **API Contracts**: `contracts/ai-agent.openapi.yaml` - REST API spec
- **AI Models**: `contracts/ai-models.md` - Model integration details

## Support

For questions or issues during implementation:
- Review constitution requirements: `.specify/memory/constitution.md`
- Check MCP tools: Use Ref MCP for SDK documentation
- Database issues: Use Supabase MCP tools for inspection

---

**Estimated Total Implementation Time**: 25-35 hours

**Critical Path**: Database → Repositories → Services → Routes → UI Components → Testing
