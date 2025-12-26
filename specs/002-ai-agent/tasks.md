# Tasks: AI Agent Assistant

**Input**: Design documents from `/specs/002-ai-agent/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL for this feature (not explicitly requested in spec.md)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Install backend AI dependencies in apps/api/package.json (ai@^4.0.0, @ai-sdk/anthropic@^1.0.0, @ai-sdk/google@^1.0.0, pdf-parse@^1.1.1)
- [X] T002 [P] Install frontend testing dependencies in apps/web/package.json (@testing-library/react@^14.0.0, vitest@^1.1.0)
- [X] T003 [P] Add environment variables to apps/api/.env (ANTHROPIC_API_KEY, GOOGLE_API_KEY, AI_DEFAULT_PROVIDER, AI_DEFAULT_MODEL)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Schema

- [X] T004 Create migration file packages/database/migrations/013_ai_agent_schema.sql with all enums (consultant_role, conversation_status, message_role, processing_status, task_type, approval_status, usage_action_type)
- [X] T005 Add ai_conversations table with RLS policies to migration file packages/database/migrations/013_ai_agent_schema.sql
- [X] T006 [P] Add ai_messages table with RLS policies to migration file packages/database/migrations/013_ai_agent_schema.sql
- [X] T007 [P] Add ai_documents table with RLS policies to migration file packages/database/migrations/013_ai_agent_schema.sql
- [X] T008 [P] Add ai_tasks table with RLS policies to migration file packages/database/migrations/013_ai_agent_schema.sql
- [X] T009 [P] Add ai_usage_records table with RLS policies to migration file packages/database/migrations/013_ai_agent_schema.sql
- [X] T010 [P] Add ai_audit_logs table with RLS policies to migration file packages/database/migrations/013_ai_agent_schema.sql
- [X] T011 [P] Add ai_configurations table with RLS policies to migration file packages/database/migrations/013_ai_agent_schema.sql
- [X] T012 Add database functions (cleanup_old_ai_conversations, get_user_ai_usage, check_ai_tier_limit) to migration file packages/database/migrations/013_ai_agent_schema.sql
- [X] T013 Add indexes for performance optimization to migration file packages/database/migrations/013_ai_agent_schema.sql
- [X] T014 Add pg_cron job for 90-day conversation cleanup to migration file packages/database/migrations/013_ai_agent_schema.sql
- [X] T015 Add default system configurations to migration file packages/database/migrations/013_ai_agent_schema.sql
- [X] T016 Apply migration using Supabase MCP and verify all 7 tables created

### Shared Types and Validation

- [X] T017 Create TypeScript types in packages/shared/src/types/ai.ts (Conversation, Message, Document, Task, UsageRecord, AuditLog, Configuration)
- [X] T018 [P] Create AI model types in packages/shared/src/types/ai-models.ts (ConsultantRole, ModelProvider, AIModelConfig)
- [X] T019 Create Zod validation schemas in packages/shared/src/validation/ai.ts (createConversationSchema, sendMessageSchema, updateTaskStatusSchema)
- [X] T020 Update packages/shared/src/types/index.ts to export ai.ts and ai-models.ts
- [X] T021 Update packages/shared/src/validation/index.ts to export ai.ts

### AI Model Integration Core

- [X] T022 Create ModelFactory in apps/api/src/lib/ai-models/model-factory.ts with getDefaultModel() and getSummaryModel() methods
- [X] T023 [P] Create ConversationContextManager in apps/api/src/lib/context-manager.ts with prepareContext() and summarizeMessages() methods
- [X] T024 [P] Create DataAccessLayer in apps/api/src/lib/data-access-layer.ts for permission-aware data retrieval
- [X] T025 Create AI rate limiting middleware in apps/api/src/middleware/ai-rate-limit.ts (10 questions/minute limit)

### Base Repositories

- [X] T026 Create AIConversationRepository in apps/api/src/repositories/ai-conversation.repository.ts extending BaseRepository
- [X] T027 [P] Create AIMessageRepository in apps/api/src/repositories/ai-message.repository.ts extending BaseRepository
- [X] T028 [P] Create AIUsageRepository in apps/api/src/repositories/ai-usage.repository.ts extending BaseRepository
- [X] T029 [P] Create AITaskRepository in apps/api/src/repositories/ai-task.repository.ts extending BaseRepository
- [X] T030 [P] Create AIDocumentRepository in apps/api/src/repositories/ai-document.repository.ts extending BaseRepository

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Data-Aware Question Answering (Priority: P1) 🎯 MVP

**Goal**: Users can ask questions about their business data and receive accurate, context-aware answers

**Independent Test**: Ask various questions about existing ERP data (sales, inventory, customers) and verify AI provides accurate answers based only on user's actual data

### Implementation for User Story 1

- [X] T031 [P] [US1] Create system prompt builder function in apps/api/src/lib/ai-models/system-prompts.ts with BASE_SYSTEM_PROMPT and ROLE_PROMPTS
- [X] T032 [US1] Implement AIAgentService in apps/api/src/services/ai-agent.service.ts with processMessage() method for streaming AI responses
- [X] T033 [US1] Implement AIConversationService in apps/api/src/services/ai-conversation.service.ts with create(), list(), get(), update(), delete() methods
- [X] T034 [US1] Implement AIUsageService in apps/api/src/services/ai-usage.service.ts with checkLimit(), trackUsage(), getStats() methods
- [X] T035 [US1] Create conversations routes in apps/api/src/routes/ai-conversations.routes.ts (GET /api/ai/conversations, POST /api/ai/conversations, GET /api/ai/conversations/:id, PATCH /api/ai/conversations/:id, DELETE /api/ai/conversations/:id)
- [X] T036 [US1] Create messages endpoint in apps/api/src/routes/ai-conversations.routes.ts (POST /api/ai/conversations/:id/messages with SSE streaming)
- [X] T037 [US1] Create usage endpoint in apps/api/src/routes/ai-conversations.routes.ts (GET /api/ai/usage)
- [X] T038 [US1] Register AI routes in apps/api/src/index.ts
- [X] T039 [P] [US1] Create AI panel container component in apps/web/src/components/ai/ai-panel.tsx with toggle functionality
- [X] T040 [P] [US1] Create chat interface component in apps/web/src/components/ai/chat-interface.tsx with message display and streaming response handling
- [X] T041 [P] [US1] Create role selector component in apps/web/src/components/ai/role-selector.tsx (general, marketing, legal, customer_service, financial_analyst)
- [X] T042 [P] [US1] Create usage indicator component in apps/web/src/components/ai/usage-indicator.tsx showing daily/monthly limits
- [X] T043 [US1] Create Zustand store in apps/web/src/stores/ai-panel-store.ts for panel state management
- [X] T044 [US1] Create TanStack Query hooks in apps/web/src/hooks/use-ai-conversation.ts (useConversations, useCreateConversation, useSendMessage)
- [X] T045 [US1] Create TanStack Query hooks in apps/web/src/hooks/use-ai-usage.ts (useUsageStats)
- [X] T046 [US1] Add AI panel to dashboard layout in apps/web/src/app/[locale]/(dashboard)/layout.tsx and add AI button to header
- [X] T047 [P] [US1] Add English localization keys in apps/web/src/locales/en/ai.json for AI feature
- [X] T048 [P] [US1] Add Arabic localization keys in apps/web/src/locales/ar/ai.json for AI feature with RTL support

**Checkpoint**: User Story 1 complete - Users can ask questions and receive AI responses with conversation management

---

## Phase 4: User Story 2 - Automated Task Execution (Priority: P2)

**Goal**: Users can instruct AI to perform routine tasks (create invoices, orders, payments) through natural language

**Independent Test**: Issue commands to create various transactions and verify they are correctly created with proper validation

### Implementation for User Story 2

- [X] T049 [US2] Extend AIAgentService in apps/api/src/services/ai-agent.service.ts with task generation logic (detectTaskIntent, generateTaskData)
- [X] T050 [US2] Implement task validation against business rules in apps/api/src/services/ai-agent.service.ts
- [X] T051 [US2] Create AITaskService in apps/api/src/services/ai-task.service.ts with create(), list(), get(), updateStatus(), execute() methods
- [X] T052 [US2] Create tasks routes in apps/api/src/routes/ai-tasks.routes.ts (GET /api/ai/tasks, GET /api/ai/tasks/:id, PATCH /api/ai/tasks/:id)
- [X] T053 [US2] Implement task execution logic in apps/api/src/services/ai-task.service.ts (navigation to form pages with pre-filled data)
- [X] T054 [US2] Register task routes in apps/api/src/index.ts
- [X] T055 [P] [US2] Create task preview component in apps/web/src/components/ai/task-preview.tsx for AI-generated transactions
- [X] T056 [US2] Add task approval workflow to chat interface in apps/web/src/components/ai/chat-interface.tsx
- [X] T057 [US2] Create TanStack Query hooks in apps/web/src/hooks/use-ai-tasks.ts (useTasks, useUpdateTaskStatus)
- [X] T058 [US2] Implement form navigation with pre-filled data in apps/web/src/components/ai/task-preview.tsx
- [X] T059 [US2] Add AI-generated indicator to transaction forms (apps/web/src/components/forms/invoice-form.tsx, apps/web/src/components/forms/party-form.tsx, apps/web/src/components/forms/payment-form.tsx)

**Checkpoint**: User Story 2 complete - Users can create transactions via AI with approval workflow ✅

---

## Phase 5: User Story 3 - Document Processing and Data Extraction (Priority: P3)

**Goal**: Users can upload documents (images, PDFs) and AI extracts relevant data to populate transactions

**Independent Test**: Upload sample invoices, receipts, and price lists, then verify AI correctly extracts and structures data

### Implementation for User Story 3

- [X] T060 [US3] Implement AIDocumentService in apps/api/src/services/ai-document.service.ts with upload(), process(), getExtractionPrompt() methods
- [X] T061 [US3] Add document processing with AI vision capabilities in apps/api/src/services/ai-document.service.ts (PDF text extraction + vision API)
- [X] T062 [US3] Implement structured data parsing from AI extraction results in apps/api/src/services/ai-document.service.ts
- [X] T063 [US3] Create document routes in apps/api/src/routes/ai-documents.routes.ts (POST /api/ai/documents, GET /api/ai/documents/:id)
- [X] T064 [US3] Add Supabase Storage bucket configuration for ai-documents with tenant isolation
- [X] T065 [US3] Register document routes in apps/api/src/index.ts
- [X] T066 [P] [US3] Create document upload component in apps/web/src/components/ai/document-upload.tsx with drag-and-drop
- [X] T067 [US3] Add file type validation in apps/web/src/components/ai/document-upload.tsx (PDF, PNG, JPG, max 10MB)
- [X] T068 [US3] Create TanStack Query hooks in apps/web/src/hooks/use-ai-documents.ts (useUploadDocument, useDocument)
- [X] T069 [US3] Add document processing status display in apps/web/src/components/ai/chat-interface.tsx
- [X] T070 [US3] Integrate extracted data with task generation in apps/web/src/components/ai/chat-interface.tsx

**Checkpoint**: User Story 3 complete - Users can upload documents and AI extracts structured data

---

## Phase 6: User Story 4 - Business Report Generation (Priority: P4)

**Goal**: Users can request custom reports and analyses through natural language

**Independent Test**: Request various report types (sales analysis, inventory reports, financial summaries) and verify accuracy against actual data

### Implementation for User Story 4

- [X] T071 [US4] Extend AIAgentService in apps/api/src/services/ai-agent.service.ts with report generation logic (detectReportIntent, generateReport)
- [X] T072 [US4] Implement data aggregation queries in apps/api/src/lib/data-access-layer.ts for common report types
- [X] T073 [US4] Add report formatting and export capabilities in apps/api/src/services/ai-agent.service.ts
- [X] T074 [P] [US4] Create report display component in apps/web/src/components/ai/report-display.tsx with tables and charts
- [X] T075 [US4] Add report export buttons in apps/web/src/components/ai/report-display.tsx (CSV, PDF)
- [X] T076 [US4] Integrate report generation with chat interface in apps/web/src/components/ai/chat-interface.tsx

**Checkpoint**: User Story 4 complete - Users can generate custom reports via AI

---

## Phase 7: User Story 5 - Role-Based Consulting Modes (Priority: P5)

**Goal**: Users can engage AI in different consulting roles with specialized guidance

**Independent Test**: Switch between different consultant roles and verify AI provides contextually appropriate advice for each role

### Implementation for User Story 5

- [ ] T077 [US5] Enhance system prompts in apps/api/src/lib/ai-models/system-prompts.ts with detailed role-specific instructions
- [ ] T078 [US5] Implement role switching logic in apps/api/src/services/ai-conversation.service.ts with conversation context update
- [ ] T079 [US5] Add role-specific data access patterns in apps/api/src/lib/data-access-layer.ts (e.g., marketing focuses on sales trends)
- [ ] T080 [US5] Enhance role selector UI in apps/web/src/components/ai/role-selector.tsx with role descriptions and icons
- [ ] T081 [US5] Add role-specific welcome messages in apps/web/src/components/ai/chat-interface.tsx
- [ ] T082 [US5] Implement role persistence across sessions in apps/web/src/stores/ai-panel-store.ts

**Checkpoint**: User Story 5 complete - Users can use specialized consultant roles

---

## Phase 8: Admin Dashboard and Controls

**Purpose**: SaaS admin features for monitoring and managing AI usage across all tenants

- [ ] T083 Implement admin usage statistics service in apps/api/src/services/ai-admin.service.ts (getAggregateUsage, getTenantUsage, disableTenantAI)
- [ ] T084 Implement admin configuration service in apps/api/src/services/ai-admin.service.ts (getConfigurations, upsertConfiguration)
- [ ] T085 Create admin routes in apps/api/src/routes/ai-admin.routes.ts (GET /api/ai/admin/usage, GET /api/ai/admin/configurations, POST /api/ai/admin/configurations, POST /api/ai/admin/tenants/:id/disable)
- [ ] T086 Add admin permission checks to admin routes in apps/api/src/routes/ai-admin.routes.ts
- [ ] T087 Register admin routes in apps/api/src/index.ts
- [ ] T088 [P] Create admin dashboard page in apps/web/src/app/[locale]/(dashboard)/settings/ai-admin/page.tsx
- [ ] T089 [P] Create usage dashboard component in apps/web/src/components/admin/ai-usage-dashboard.tsx with charts and filters
- [ ] T090 Create TanStack Query hooks in apps/web/src/hooks/use-ai-admin.ts (useAdminUsage, useAdminConfigs)

---

## Phase 9: Audit Logging and Security

**Purpose**: Comprehensive audit trails and security hardening

- [ ] T091 Implement audit logging in apps/api/src/services/ai-audit.service.ts (logInteraction, logTaskExecution, logPermissionDenial)
- [ ] T092 Add audit logging calls to AIAgentService in apps/api/src/services/ai-agent.service.ts
- [ ] T093 Add audit logging calls to AITaskService in apps/api/src/services/ai-task.service.ts
- [ ] T094 Add audit logging calls to AIDocumentService in apps/api/src/services/ai-document.service.ts
- [ ] T095 [P] Implement data sanitization in apps/api/src/lib/data-access-layer.ts (remove passwords, API keys, payment details)
- [ ] T096 [P] Add XSS prevention in frontend components (sanitize AI responses before rendering)
- [ ] T097 Add permission context to all audit logs in apps/api/src/services/ai-audit.service.ts

---

## Phase 10: Error Handling and Resilience

**Purpose**: Graceful degradation and retry mechanisms

- [ ] T098 Create AIError class in apps/api/src/lib/ai-models/errors.ts with error codes and retry logic
- [ ] T099 Implement retry queue for failed AI requests in apps/api/src/services/ai-queue.service.ts (3 attempts over 5 minutes)
- [ ] T100 Add exponential backoff retry logic in apps/api/src/services/ai-agent.service.ts
- [ ] T101 Implement graceful degradation when AI service unavailable in apps/api/src/services/ai-agent.service.ts
- [ ] T102 [P] Add error notifications in apps/web/src/components/ai/chat-interface.tsx (usage limits, service unavailable, etc.)
- [ ] T103 [P] Add retry status display in apps/web/src/components/ai/chat-interface.tsx

---

## Phase 11: Multi-Language Support

**Purpose**: Full RTL support and Arabic localization

- [ ] T104 Add language detection in system prompts in apps/api/src/lib/ai-models/system-prompts.ts
- [ ] T105 Implement bilingual AI responses based on user locale in apps/api/src/services/ai-agent.service.ts
- [ ] T106 [P] Add RTL styles to AI panel in apps/web/src/components/ai/ai-panel.tsx
- [ ] T107 [P] Add RTL styles to chat interface in apps/web/src/components/ai/chat-interface.tsx
- [ ] T108 Test Arabic document processing (PDF/image extraction) with AIDocumentService

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation

- [ ] T109 [P] Optimize database queries with proper indexes in packages/database/migrations/013_ai_agent_schema.sql
- [ ] T110 [P] Add loading skeletons in apps/web/src/components/ai/chat-interface.tsx
- [ ] T111 [P] Add empty states in apps/web/src/components/ai/ai-panel.tsx (no conversations, no messages)
- [ ] T112 Add keyboard shortcuts for AI panel toggle in apps/web/src/components/ai/ai-panel.tsx
- [ ] T113 Implement conversation export functionality in apps/web/src/components/ai/chat-interface.tsx
- [ ] T114 Add cost tracking dashboard for SaaS admin in apps/web/src/components/admin/ai-usage-dashboard.tsx
- [ ] T115 Run quickstart.md validation (test all 5 user stories, verify limits, test multi-language, test security)
- [ ] T116 Performance testing (verify 100 concurrent conversations target)
- [ ] T117 Verify all acceptance scenarios from spec.md
- [ ] T118 Security audit (verify RLS policies prevent cross-tenant access)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3 → US4 → US5)
- **Admin Dashboard (Phase 8)**: Can run in parallel with User Stories 4-5
- **Audit/Security (Phase 9)**: Depends on all User Stories
- **Error Handling (Phase 10)**: Can run in parallel with User Stories
- **Multi-Language (Phase 11)**: Depends on User Story 1 completion
- **Polish (Phase 12)**: Depends on all previous phases

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅ MVP
- **User Story 2 (P2)**: Depends on User Story 1 (needs conversation and agent service)
- **User Story 3 (P3)**: Depends on User Story 1 (needs conversation infrastructure)
- **User Story 4 (P4)**: Depends on User Story 1 (needs AI agent service)
- **User Story 5 (P5)**: Depends on User Story 1 (needs conversation and role infrastructure)

### Within Each User Story

- Backend services before routes
- Routes before frontend components
- Core components before integration
- Story complete before moving to next priority

### Parallel Opportunities

- **Setup (Phase 1)**: All 3 tasks can run in parallel
- **Foundational Database (Phase 2)**: T006-T011 (table creation) can run in parallel after T004-T005
- **Foundational Repositories (Phase 2)**: T027-T030 can run in parallel after T026
- **User Story 1 Frontend (Phase 3)**: T039-T042, T047-T048 can run in parallel
- **Once Foundational completes**: User Stories 3, 4, 5 can start in parallel while US2 is being built (US2 depends on US1)

---

## Parallel Example: User Story 1

```bash
# After T030 completes, launch all these in parallel:
Task T031: Create system prompts (apps/api/src/lib/ai-models/system-prompts.ts)
Task T039: AI panel container (apps/web/src/components/ai/ai-panel.tsx)
Task T040: Chat interface (apps/web/src/components/ai/chat-interface.tsx)
Task T041: Role selector (apps/web/src/components/ai/role-selector.tsx)
Task T042: Usage indicator (apps/web/src/components/ai/usage-indicator.tsx)
Task T047: English localization (apps/web/src/locales/en/common.json)
Task T048: Arabic localization (apps/web/src/locales/ar/common.json)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T030) - CRITICAL
3. Complete Phase 3: User Story 1 (T031-T048)
4. **STOP and VALIDATE**: Test conversation creation, message exchange, AI responses, usage limits
5. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready (T001-T030)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!) (T031-T048)
3. Add User Story 2 → Test independently → Deploy/Demo (T049-T059)
4. Add User Story 3 → Test independently → Deploy/Demo (T060-T070)
5. Add User Story 4 → Test independently → Deploy/Demo (T071-T076)
6. Add User Story 5 → Test independently → Deploy/Demo (T077-T082)
7. Add Admin + Security + Polish → Final release (T083-T118)

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T030)
2. Once Foundational is done:
   - Developer A: User Story 1 (T031-T048)
   - Developer B: User Story 3 (T060-T070) - can start in parallel
   - Developer C: User Story 4 (T071-T076) - can start in parallel
3. After User Story 1 completes:
   - Developer A: User Story 2 (T049-T059) - depends on US1
4. Stories complete and integrate independently

---

## Total Task Count

- **Setup**: 3 tasks
- **Foundational**: 27 tasks (T004-T030)
- **User Story 1**: 18 tasks (T031-T048)
- **User Story 2**: 11 tasks (T049-T059)
- **User Story 3**: 11 tasks (T060-T070)
- **User Story 4**: 6 tasks (T071-T076)
- **User Story 5**: 6 tasks (T077-T082)
- **Admin Dashboard**: 8 tasks (T083-T090)
- **Audit/Security**: 7 tasks (T091-T097)
- **Error Handling**: 6 tasks (T098-T103)
- **Multi-Language**: 5 tasks (T104-T108)
- **Polish**: 10 tasks (T109-T118)

**Total**: 118 tasks

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests are OPTIONAL (not included as spec.md doesn't explicitly request TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- MVP = User Story 1 only (T001-T048, 48 tasks total)
- All tasks follow strict checklist format: `- [ ] [ID] [P?] [Story?] Description with file path`
