# Research: AI Agent Assistant

**Feature**: AI Agent Assistant
**Date**: 2025-12-26
**Phase**: 0 - Research & Technology Decisions

## Overview

This document captures research findings and technology decisions for implementing the AI Agent Assistant feature in the ERP system. All unknowns from the Technical Context section have been investigated and resolved.

## Research Areas

### 1. AI Model SDK Selection

**Question**: Which SDK approach should we use for integrating multiple AI model providers (Claude, Gemini)?

**Research Findings**:
- **Option 1**: Direct SDK integration (Anthropic SDK + Google Generative AI SDK)
  - Pros: Direct access to all provider-specific features, maximum control
  - Cons: Need to write abstraction layer, different APIs for each provider

- **Option 2**: Vercel AI SDK (unified abstraction)
  - Pros: Single API for multiple providers, built-in streaming, TypeScript-first, production-ready
  - Cons: May not expose every provider-specific feature immediately
  - Supports: Anthropic, Google Generative AI, OpenAI, and 15+ other providers
  - Features: Unified streaming, tool calling, structured output, React hooks

**Decision**: **Use Vercel AI SDK (`ai` package) with provider adapters**

**Rationale**:
1. Single unified API simplifies switching between Claude, Gemini, and future providers
2. Built-in streaming support (`streamText`) matches NFR-001 requirement (<3s response time)
3. TypeScript-native with strong type safety
4. Active maintenance by Vercel (Next.js creators), aligns with our Next.js frontend
5. Framework-agnostic core works with our Express backend
6. Provider-specific features accessible via `@ai-sdk/anthropic` and `@ai-sdk/google`
7. Reduces code duplication and maintenance burden

**Alternatives Considered**:
- LangChain: More complex, focused on agents/chains rather than simple chat
- Direct SDKs: More code to maintain, harder to switch providers

**Implementation**:
```typescript
// Backend dependencies
"ai": "^4.0.0",
"@ai-sdk/anthropic": "^1.0.0",
"@ai-sdk/google": "^1.0.0"
```

**References**:
- https://ai-sdk.dev/docs/introduction
- https://ai-sdk.dev/docs/ai-sdk-core/generating-text

---

### 2. Conversation Context Management

**Question**: How should we implement sliding window context management and token counting for 50+ message conversations?

**Research Findings**:
- AI SDK automatically handles token counting for supported providers
- Providers return usage data in response metadata
- Sliding window requires custom implementation

**Decision**: **Custom context manager with AI SDK usage tracking**

**Rationale**:
1. AI SDK provides token usage in `generateText` and `streamText` responses
2. Need custom logic for sliding window (keep recent 20 messages, summarize older)
3. Each provider has different context limits (Claude: 200K tokens, Gemini: 1M tokens)
4. Summarization can use the same AI model (cheaper/smaller model for summaries)

**Implementation Approach**:
```typescript
// apps/api/src/lib/context-manager.ts
class ConversationContextManager {
  private readonly MAX_RECENT_MESSAGES = 20;
  private readonly SUMMARY_MODEL = "claude-haiku-4"; // Fast, cheap

  async prepareContext(messages: Message[]): Promise<Message[]> {
    if (messages.length <= this.MAX_RECENT_MESSAGES) {
      return messages;
    }

    const recent = messages.slice(-this.MAX_RECENT_MESSAGES);
    const older = messages.slice(0, -this.MAX_RECENT_MESSAGES);

    // Summarize older messages using AI
    const summary = await this.summarizeMessages(older);

    return [
      { role: 'system', content: `Previous conversation summary: ${summary}` },
      ...recent
    ];
  }

  async summarizeMessages(messages: Message[]): Promise<string> {
    const { text } = await generateText({
      model: anthropic(this.SUMMARY_MODEL),
      prompt: `Summarize this conversation history concisely: ${JSON.stringify(messages)}`
    });
    return text;
  }
}
```

**Alternatives Considered**:
- Fixed token limit truncation: Less context-aware, loses important earlier context
- tiktoken library: Provider-specific, AI SDK already provides token counts

**References**:
- https://platform.openai.com/docs/guides/conversation-state

---

### 3. Document Processing Technology

**Question**: Confirm approach for extracting text and structured data from PDFs and images?

**Research Findings**:
- AI SDK supports vision capabilities via provider adapters
- Both Claude (Sonnet 4.5) and Gemini Pro Vision support image input
- PDF processing: Convert to images or extract text first, then send to vision model
- AI SDK handles multimodal inputs natively

**Decision**: **Use AI SDK vision capabilities with file preprocessing**

**Rationale**:
1. Feature spec (FR-016) specifies using AI model's multimodal features
2. AI SDK's `generateText` accepts image data URLs or URLs
3. Claude and Gemini both support vision, consistent API
4. For PDFs: Use `pdf-parse` (Node.js) to extract text, or `pdf-to-png` for visual extraction
5. Images (PNG/JPG): Pass directly to vision model

**Implementation Approach**:
```typescript
// apps/api/src/services/ai-document.service.ts
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import pdfParse from 'pdf-parse';

async function extractFromDocument(file: Buffer, mimeType: string) {
  if (mimeType === 'application/pdf') {
    // Option 1: Text extraction for text-heavy PDFs
    const pdfData = await pdfParse(file);
    return await generateText({
      model: anthropic('claude-sonnet-4-5'),
      prompt: `Extract structured data from this invoice: ${pdfData.text}`
    });
  } else {
    // Option 2: Vision for images and visual PDFs
    const base64 = file.toString('base64');
    return await generateText({
      model: anthropic('claude-sonnet-4-5'),
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Extract invoice data (supplier, items, amounts):' },
          { type: 'image', image: `data:${mimeType};base64,${base64}` }
        ]
      }]
    });
  }
}
```

**Dependencies**:
```json
{
  "pdf-parse": "^1.1.1",
  "sharp": "^0.33.0"  // For image processing if needed
}
```

**Alternatives Considered**:
- Tesseract OCR: Less accurate than AI vision, requires separate OCR step
- Google Cloud Vision API: Adds another service dependency, not needed

**References**:
- https://docs.claude.com/en/docs/build-with-claude/vision
- https://ai-sdk.dev/docs/ai-sdk-core/generating-text (multimodal support)

---

### 4. Testing Strategy

**Question**: What testing approach for frontend components and E2E testing?

**Research Findings**:
- Frontend: React Testing Library recommended for Next.js/React components
- E2E: Constitution requires Chrome DevTools MCP for browser automation
- API: Existing Vitest setup works for backend

**Decision**: **React Testing Library + Vitest for components, Chrome DevTools MCP for E2E**

**Rationale**:
1. React Testing Library aligns with Next.js best practices
2. Vitest works for both backend and frontend testing (monorepo consistency)
3. Chrome DevTools MCP required by constitution for browser automation
4. MCP provides accessibility tree inspection (`take_snapshot`) for panel UI

**Implementation**:
```json
// apps/web/package.json additions
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "vitest": "^1.1.0",
    "@vitejs/plugin-react": "^4.2.0"
  }
}
```

**E2E Test Example** (using Chrome DevTools MCP):
```typescript
// Test AI panel toggle and message sending
mcp__chrome-devtools__navigate_page({ url: 'http://localhost:3000/dashboard' });
mcp__chrome-devtools__take_snapshot(); // Verify initial state
mcp__chrome-devtools__click({ elementId: 'ai-panel-toggle' });
mcp__chrome-devtools__fill({ elementId: 'ai-message-input', value: 'What were my sales last month?' });
mcp__chrome-devtools__click({ elementId: 'ai-send-button' });
// Wait and verify response appears
```

**Alternatives Considered**:
- Playwright: Violates constitution (must use Chrome DevTools MCP)
- Jest: Vitest is faster and more modern

---

### 5. Conversation Data Retention Strategy

**Question**: Beyond the 90-day retention policy, what's the cleanup implementation approach?

**Research Findings**:
- Supabase supports scheduled functions (pg_cron extension)
- Can implement soft delete vs hard delete
- Need to consider audit requirements (FR-007)

**Decision**: **Scheduled cleanup with audit trail preservation**

**Rationale**:
1. Conversations soft-deleted after 90 days (set `deleted_at` timestamp)
2. Audit logs preserved permanently (separate table)
3. Usage metrics aggregated before deletion
4. Supabase pg_cron runs daily cleanup job

**Implementation Approach**:
```sql
-- In migration 013_ai_agent_schema.sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Scheduled cleanup (runs daily at 2 AM)
SELECT cron.schedule(
  'cleanup-old-conversations',
  '0 2 * * *',
  $$
    UPDATE ai_conversations
    SET deleted_at = NOW()
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND deleted_at IS NULL;
  $$
);
```

**Audit Preservation**:
- `ai_audit_logs` table keeps records indefinitely
- Links to deleted conversation IDs maintained
- Usage data aggregated to tenant-level metrics before deletion

**Alternatives Considered**:
- Hard delete immediately: Loses audit trail capability
- Keep forever: Storage costs grow unbounded
- External archival: Adds complexity, not needed for 90-day policy

---

### 6. Rate Limiting Implementation

**Question**: How to implement 10 questions/minute + daily/monthly tier limits?

**Research Findings**:
- Existing system uses `express-rate-limit` (see apps/api/src/middleware/index.ts)
- Need separate limits: per-minute (all users) + daily/monthly (tier-based)
- Supabase can track usage counts

**Decision**: **Layered rate limiting: express-rate-limit + database usage tracking**

**Rationale**:
1. Minute-level: express-rate-limit middleware (in-memory, fast)
2. Daily/monthly: Database queries check usage against tier limits
3. Existing pattern in codebase for consistency

**Implementation Approach**:
```typescript
// apps/api/src/middleware/ai-rate-limit.ts
import rateLimit from 'express-rate-limit';

// Layer 1: Per-minute limit (all users)
export const aiQuestionRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many AI requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Layer 2: Daily/monthly limits (checked in service)
// apps/api/src/services/ai-usage.service.ts
async function checkTierLimits(userId: string, action: 'question' | 'document' | 'task') {
  const user = await getUserWithSubscription(userId);
  const usage = await getTodayUsage(userId);

  const limits = {
    free: { questions: 25, documents: 3, tasks: 5 },
    premium: { questions: Infinity, documents: 100, tasks: Infinity }
  };

  if (usage.questions >= limits[user.tier].questions) {
    throw new UsageLimitError('Daily question limit reached. Upgrade to continue.');
  }
}
```

**Alternatives Considered**:
- Redis-based limiting: Adds dependency, express-rate-limit sufficient for 100 concurrent users
- Only database tracking: Too slow for per-minute limits

---

## Technology Stack Summary

### Backend Dependencies (apps/api/package.json)
```json
{
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/google": "^1.0.0",
    "pdf-parse": "^1.1.1",
    "express-rate-limit": "^7.1.5"  // Already installed
  }
}
```

### Frontend Dependencies (apps/web/package.json)
```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "vitest": "^1.1.0",
    "@vitejs/plugin-react": "^4.2.0"
  }
}
```

### Environment Variables Required
```bash
# AI Model Provider API Keys
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIzaSy...

# Model Selection (optional, defaults to Claude)
AI_DEFAULT_PROVIDER=anthropic  # or 'google'
AI_DEFAULT_MODEL=claude-sonnet-4-5
AI_SUMMARY_MODEL=claude-haiku-4
```

---

## Best Practices Identified

### 1. Streaming Response Handling
- Use AI SDK `streamText` for all user-facing responses (NFR-001: <3s to first token)
- Backend streams to frontend via Server-Sent Events (SSE)
- Frontend uses `useChat` hook (AI SDK UI) for real-time display

### 2. Error Handling
- AI SDK throws provider-specific errors
- Implement retry logic with exponential backoff (NFR-006: 3 attempts over 5 minutes)
- Queue failed requests in database for retry

### 3. Security
- Never send user passwords, API keys, or payment details to AI (FR-008)
- Sanitize AI responses before rendering (XSS prevention)
- Use RLS policies to ensure data access respects permissions (FR-006)

### 4. Multi-language Support
- AI models (Claude, Gemini) handle Arabic natively
- Store user's preferred language in conversation metadata
- Include language preference in system prompts

### 5. Audit Logging
- Log every AI interaction: prompt, response, tokens used, model, timestamp (FR-007)
- Separate audit table from conversations for permanent retention
- Include permission context (what data user could access)

---

## Open Questions Resolved

1. **AI Model SDK**: ✅ Vercel AI SDK with provider adapters
2. **Context Management**: ✅ Custom sliding window with AI-powered summarization
3. **Document Processing**: ✅ AI SDK vision capabilities with pdf-parse preprocessing
4. **Testing Strategy**: ✅ React Testing Library + Chrome DevTools MCP for E2E
5. **Data Retention**: ✅ 90-day soft delete with pg_cron, audit logs preserved
6. **Rate Limiting**: ✅ Layered approach (express-rate-limit + database tier checks)

---

## Next Steps

**Phase 1 Prerequisites Met**: All technical unknowns resolved. Ready to proceed with:
1. Data model design (entities, relationships, schema)
2. API contract definition (OpenAPI spec)
3. Quickstart guide creation

**No blockers identified.** All decisions align with constitution requirements and existing codebase patterns.
