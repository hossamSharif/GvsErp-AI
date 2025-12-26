# Implementation Plan: AI Agent Assistant

**Branch**: `002-ai-agent` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-ai-agent/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

AI Agent Assistant provides an intelligent conversational interface embedded in the ERP system, enabling users to query their business data, automate routine tasks (invoices, orders, payments), extract data from uploaded documents, and receive role-based consulting guidance. The agent will use AI model APIs (Claude, Gemini, etc.) to provide context-aware responses strictly limited to the user's tenant data, with tiered subscription limits (free tier: 25 questions/day, 3 documents/month, 5 tasks/month; premium tier: unlimited questions, 100 documents/month, unlimited tasks). The system will include a toggle-able side panel UI, admin usage dashboard, conversation management with sliding-window context handling, and comprehensive audit trails for all AI interactions and generated transactions.

## Technical Context

**Language/Version**: TypeScript 5.3+ (Node.js 20+)
**Primary Dependencies**:
- Backend: Express.js 4.18, Supabase JS Client 2.39, Zod 3.22, Stripe 14.10
- Frontend: Next.js 14.1, React 18.2, TanStack Query 5.17, Radix UI, Tailwind CSS
- AI Model SDKs: NEEDS CLARIFICATION (Anthropic Claude SDK, Google Gemini SDK, or unified abstraction)
- Conversation context management: NEEDS CLARIFICATION (token counting, summarization approach)
- Document processing: AI model vision capabilities (multimodal features)

**Storage**: Supabase PostgreSQL (existing database with RLS policies)
**Testing**: Vitest (backend unit/integration), NEEDS CLARIFICATION (frontend component tests, E2E testing strategy)
**Target Platform**: Web application (Linux/Docker backend, modern browsers including mobile web)
**Project Type**: Web (monorepo with apps/api backend + apps/web Next.js frontend)
**Performance Goals**:
- AI response latency: <3s to first token for 90% of requests
- Concurrent conversations: 100+ without degradation
- Document processing: <10s for up to 10-page documents
- UI responsiveness: Side panel toggle <100ms

**Constraints**:
- Strict tenant data isolation (RLS enforcement)
- AI responses scoped to user's role permissions
- NFR-004: Context window management with sliding window (50+ message exchanges)
- NFR-006: Graceful degradation with retry queue (3 attempts over 5 minutes) when AI service unavailable
- Rate limiting: 10 questions/minute per user, tiered daily/monthly limits
- Document uploads: 10MB max file size
- Multi-language support: English and Arabic (with RTL)

**Scale/Scope**:
- Initial: 100 concurrent conversations, multi-tenant SaaS
- User base: Thousands of tenants, variable conversation load
- 5 user stories (P1-P5), 45 functional requirements, 6 non-functional requirements
- New feature addition to existing ERP system (12 existing modules)
- NEEDS CLARIFICATION: Estimated conversation data retention and cleanup strategy beyond 90-day policy

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. MCP Tooling Mandatory ✅ PASS

**Status**: COMPLIANT - No custom implementations required. Feature will use prescribed MCP tools:
- Ref MCP for AI model documentation lookups (Anthropic, Google SDKs)
- Supabase MCP for all database operations (migrations, schema, queries)
- Stripe MCP already in use for existing subscription management

### II. Documentation & Context via Ref MCP ✅ PASS

**Status**: COMPLIANT - Research phase will use `mcp__Ref__ref_search_documentation` for:
- Anthropic Claude SDK documentation
- Google Gemini SDK documentation
- TypeScript AI integration best practices
- No arbitrary web searches planned

### III. Database & Backend via Supabase MCP ✅ PASS

**Status**: COMPLIANT - All database operations will use Supabase MCP tools:
- New AI-related tables (conversations, messages, usage_records, tasks) via `mcp__supabase__apply_migration`
- Schema inspection via `mcp__supabase__list_tables`
- TypeScript type generation via `mcp__supabase__generate_typescript_types`
- No direct SQL execution outside MCP

### IV. Payments via Stripe MCP ✅ PASS

**Status**: COMPLIANT - Feature leverages existing Stripe MCP integration:
- Subscription tier limits enforcement (free vs premium)
- Usage tracking for billing
- No new payment operations required beyond existing subscription system

### V. Browser Automation & Testing via Chrome DevTools MCP ✅ PASS

**Status**: COMPLIANT - Testing will use Chrome DevTools MCP:
- `mcp__chrome-devtools__take_snapshot` for side panel UI verification
- `mcp__chrome-devtools__click`, `mcp__chrome-devtools__fill` for interaction testing
- `mcp__chrome-devtools__navigate_page` for multi-page conversation persistence testing
- No Puppeteer/Playwright usage planned

### VI. Git Commit Discipline ✅ PASS

**Status**: COMPLIANT - Implementation will follow commit discipline:
- Commits after each completed task from tasks.md
- Clear descriptive messages per feature component
- Work on feature branch `002-ai-agent`
- No silent failures allowed

### Security and Configuration ✅ PASS

**Status**: COMPLIANT:
- AI model API keys stored in environment variables (ANTHROPIC_API_KEY, GOOGLE_API_KEY, etc.)
- Supabase credentials already in env vars
- No hardcoded secrets planned
- RLS policies enforce tenant isolation

**Overall Gate Status**: ✅ **PASS** - All constitution principles satisfied. Proceeding to Phase 0.

---

## Post-Design Constitution Re-Evaluation

*Re-checked after Phase 1 design completion (2025-12-26)*

### I. MCP Tooling Mandatory ✅ PASS (Confirmed)

**Design Compliance**:
- ✅ Supabase MCP used for migration `013_ai_agent_schema.sql` (7 tables, RLS policies, pg_cron)
- ✅ Ref MCP used for AI SDK documentation research (Vercel AI SDK, Anthropic, Google)
- ✅ No custom database access - all via Supabase MCP
- ✅ No custom documentation fetching - all via Ref MCP

### II. Documentation & Context via Ref MCP ✅ PASS (Confirmed)

**Research Phase Compliance**:
- ✅ Used `mcp__Ref__ref_search_documentation` for:
  - Anthropic Claude SDK TypeScript streaming
  - Google Gemini SDK TypeScript vision capabilities
  - Vercel AI SDK unified abstraction
- ✅ Used `mcp__Ref__ref_read_url` for detailed documentation
- ✅ No arbitrary web searches conducted

### III. Database & Backend via Supabase MCP ✅ PASS (Confirmed)

**Data Model Compliance**:
- ✅ Migration file uses `mcp__supabase__apply_migration`
- ✅ Type generation uses `mcp__supabase__generate_typescript_types`
- ✅ Schema inspection uses `mcp__supabase__list_tables`
- ✅ All RLS policies, functions, and enums via MCP
- ✅ pg_cron job for 90-day cleanup via migration SQL

**Tables Created** (all via Supabase MCP):
1. ai_conversations
2. ai_messages
3. ai_documents
4. ai_tasks
5. ai_usage_records
6. ai_audit_logs
7. ai_configurations

### IV. Payments via Stripe MCP ✅ PASS (Confirmed)

**Design Compliance**:
- ✅ Existing Stripe MCP integration used for subscription tiers
- ✅ Usage limits enforced via database tier checks (free vs premium)
- ✅ No new payment operations required

### V. Browser Automation & Testing via Chrome DevTools MCP ✅ PASS (Confirmed)

**Testing Strategy Compliance**:
- ✅ E2E tests use Chrome DevTools MCP exclusively
- ✅ `mcp__chrome-devtools__take_snapshot` for panel UI verification
- ✅ `mcp__chrome-devtools__click`, `mcp__chrome-devtools__fill` for interactions
- ✅ No Puppeteer/Playwright mentioned in design

**Test Examples** (from quickstart.md):
```typescript
mcp__chrome-devtools__navigate_page({ url: 'http://localhost:3000/dashboard' });
mcp__chrome-devtools__click({ selector: '[data-testid="ai-panel-toggle"]' });
mcp__chrome-devtools__fill({ selector: '[data-testid="ai-message-input"]', value: 'Test' });
```

### VI. Git Commit Discipline ✅ PASS (Confirmed)

**Implementation Plan Compliance**:
- ✅ Feature branch: `002-ai-agent`
- ✅ Commits planned after each implementation phase
- ✅ Clear task structure in quickstart.md
- ✅ No silent failures allowed

### Security and Configuration ✅ PASS (Confirmed)

**Environment Variables** (from quickstart.md):
```bash
ANTHROPIC_API_KEY=sk-ant-...  # ✅ Environment variable
GOOGLE_API_KEY=AIzaSy...      # ✅ Environment variable
AI_DEFAULT_PROVIDER=anthropic # ✅ Configuration
```
- ✅ No hardcoded secrets in design
- ✅ All sensitive data in environment variables
- ✅ RLS policies enforce tenant isolation

### Design Artifacts Verification

**Phase 0: Research** ✅ Complete
- research.md: All unknowns resolved (AI SDK, context management, document processing, testing, retention, rate limiting)

**Phase 1: Design** ✅ Complete
- data-model.md: 7 entities, relationships, RLS policies, functions
- contracts/ai-agent.openapi.yaml: Complete REST API specification
- contracts/ai-models.md: AI integration contract (Vercel AI SDK, providers)
- quickstart.md: Implementation guide with phases, code examples

**Constitution Compliance Score**: 100% (6/6 principles)

**Final Gate Status**: ✅ **PASS** - Design fully complies with all constitution requirements. Ready for Phase 2 (tasks.md generation via `/speckit.tasks` command).

## Project Structure

### Documentation (this feature)

```text
specs/002-ai-agent/
├── spec.md              # Feature specification (input)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── ai-agent.openapi.yaml
│   └── ai-models.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

**Selected Structure**: Web application (monorepo with apps/api backend + apps/web Next.js frontend)

```text
apps/api/
├── src/
│   ├── services/
│   │   ├── ai-agent.service.ts         # Core AI orchestration, model API calls
│   │   ├── ai-conversation.service.ts  # Conversation management, context handling
│   │   ├── ai-usage.service.ts         # Usage tracking, tier limits enforcement
│   │   └── ai-document.service.ts      # Document upload, vision API processing
│   ├── routes/
│   │   ├── ai-conversations.routes.ts  # Conversation CRUD, message exchange
│   │   ├── ai-admin.routes.ts          # SaaS admin dashboard endpoints
│   │   └── ai-tasks.routes.ts          # AI-generated task approval/execution
│   ├── repositories/
│   │   ├── ai-conversation.repository.ts
│   │   ├── ai-message.repository.ts
│   │   ├── ai-usage.repository.ts
│   │   └── ai-task.repository.ts
│   ├── middleware/
│   │   └── ai-rate-limit.ts           # AI-specific rate limiting
│   └── lib/
│       ├── ai-models/
│       │   ├── claude-adapter.ts       # Anthropic Claude SDK wrapper
│       │   ├── gemini-adapter.ts       # Google Gemini SDK wrapper
│       │   └── model-factory.ts        # Unified model selection/abstraction
│       ├── context-manager.ts          # Sliding window, summarization logic
│       └── data-access-layer.ts        # Permission-aware data retrieval
└── tests/
    ├── unit/
    │   ├── ai-agent.service.test.ts
    │   └── context-manager.test.ts
    └── integration/
        ├── ai-conversations-api.test.ts
        └── ai-usage-tracking.test.ts

apps/web/
├── src/
│   ├── components/
│   │   ├── ai/
│   │   │   ├── ai-panel.tsx            # Toggle-able side panel container
│   │   │   ├── chat-interface.tsx      # Message display, input
│   │   │   ├── role-selector.tsx       # Consultant role picker
│   │   │   ├── usage-indicator.tsx     # Usage stats display
│   │   │   ├── document-upload.tsx     # Image/PDF upload UI
│   │   │   └── task-preview.tsx        # AI-generated transaction preview
│   │   └── admin/
│   │       └── ai-usage-dashboard.tsx  # SaaS admin monitoring
│   ├── hooks/
│   │   ├── use-ai-conversation.ts      # TanStack Query hooks for conversations
│   │   ├── use-ai-chat.ts              # Real-time message streaming
│   │   └── use-ai-usage.ts             # Usage tracking queries
│   ├── app/[locale]/(dashboard)/
│   │   └── ai-settings/
│   │       └── page.tsx                # User AI preferences
│   ├── stores/
│   │   └── ai-panel-store.ts           # Zustand store for panel state
│   └── lib/
│       └── ai-client.ts                # API client for AI endpoints
└── tests/
    └── components/
        └── ai-panel.test.tsx

packages/database/
└── migrations/
    └── 013_ai_agent_schema.sql         # AI tables, indexes, RLS policies

packages/shared/
├── src/
│   ├── types/
│   │   ├── ai.ts                       # Conversation, Message, Usage types
│   │   └── ai-models.ts                # Model provider configs
│   └── validation/
│       └── ai.ts                       # Zod schemas for AI endpoints
└── tsup.config.ts
```

**Structure Decision**: This follows the existing monorepo pattern with apps/api (Express backend) and apps/web (Next.js frontend). AI-specific code is organized into dedicated directories within each app, with shared types in packages/shared and database migrations in packages/database. The structure supports independent testing, clear separation of concerns (services, repositories, routes), and aligns with the existing ERP modules.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**No violations detected.** All constitution principles are satisfied. No complexity justification required.
