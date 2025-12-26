/**
 * AI Agent Assistant entity types
 * @module types/ai
 */

// =============================================================================
// BASE TYPES (ENUMS)
// =============================================================================

/**
 * Consultant role types for AI agent specialization
 */
export type ConsultantRole =
  | 'general'
  | 'marketing'
  | 'legal'
  | 'customer_service'
  | 'financial_analyst';

/**
 * Conversation status
 */
export type ConversationStatus = 'active' | 'archived';

/**
 * Message role (speaker in conversation)
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Document processing status
 */
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Task type (transaction types that AI can generate)
 */
export type TaskType =
  | 'invoice'
  | 'purchase_order'
  | 'sales_order'
  | 'payment'
  | 'journal_entry';

/**
 * Task approval status workflow
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'executed';

/**
 * Usage action type for tier enforcement
 */
export type UsageActionType = 'question' | 'document' | 'task';

// =============================================================================
// CONVERSATION ENTITY
// =============================================================================

/**
 * Core Conversation entity
 */
export interface Conversation {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  consultantRole: ConsultantRole;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Conversation with user details
 */
export interface ConversationWithUser extends Conversation {
  user: {
    id: string;
    fullName: string | null;
    email: string;
  };
}

/**
 * Conversation with message count
 */
export interface ConversationWithStats extends Conversation {
  messageCount: number;
  lastMessageAt: string | null;
}

// =============================================================================
// MESSAGE ENTITY
// =============================================================================

/**
 * Core Message entity
 */
export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  documentIds: string[] | null;
  tokenCount: number;
  modelUsed: string | null;
  createdAt: string;
}

/**
 * Message with document details
 */
export interface MessageWithDocuments extends Message {
  documents: Document[];
}

// =============================================================================
// DOCUMENT ENTITY
// =============================================================================

/**
 * Core Document entity
 */
export interface Document {
  id: string;
  conversationId: string;
  messageId: string | null;
  tenantId: string;
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  extractedText: string | null;
  processingStatus: ProcessingStatus;
  processingError: string | null;
  createdAt: string;
}

/**
 * Document upload response
 */
export interface DocumentUploadResponse {
  document: Document;
  uploadUrl?: string; // For client-side upload to Supabase Storage
}

// =============================================================================
// TASK ENTITY
// =============================================================================

/**
 * Core Task entity (AI-generated transactions)
 */
export interface Task {
  id: string;
  conversationId: string;
  messageId: string;
  tenantId: string;
  userId: string;
  taskType: TaskType;
  generatedData: Record<string, any>; // JSON object with transaction data
  approvalStatus: ApprovalStatus;
  executedAt: string | null;
  resultId: string | null;
  createdAt: string;
}

/**
 * Task with execution details
 */
export interface TaskWithDetails extends Task {
  conversation: {
    id: string;
    title: string;
  };
  user: {
    id: string;
    fullName: string | null;
    email: string;
  };
}

// =============================================================================
// USAGE RECORD ENTITY
// =============================================================================

/**
 * Core Usage Record entity
 */
export interface UsageRecord {
  id: string;
  tenantId: string;
  userId: string;
  actionType: UsageActionType;
  conversationId: string | null;
  tokensUsed: number;
  modelUsed: string;
  costEstimate: number | null;
  createdAt: string;
}

/**
 * Usage statistics aggregation
 */
export interface UsageStats {
  questions: number;
  documents: number;
  tasks: number;
  totalTokens: number;
  estimatedCost: number;
}

/**
 * Usage limits by tier
 */
export interface UsageLimits {
  questionsPerDay: number;
  documentsPerMonth: number;
  tasksPerMonth: number;
  questionsRemaining: number;
  documentsRemaining: number;
  tasksRemaining: number;
}

// =============================================================================
// AUDIT LOG ENTITY
// =============================================================================

/**
 * Core Audit Log entity
 */
export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  conversationId: string | null;
  action: string;
  prompt: string | null;
  response: string | null;
  dataAccessed: Record<string, any> | null;
  permissions: string[] | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/**
 * Audit log with user details
 */
export interface AuditLogWithUser extends AuditLog {
  user: {
    id: string;
    fullName: string | null;
    email: string;
  };
}

// =============================================================================
// CONFIGURATION ENTITY
// =============================================================================

/**
 * Core Configuration entity
 */
export interface Configuration {
  id: string;
  tenantId: string | null; // null for system-wide configs
  configKey: string;
  configValue: Record<string, any>; // JSONB config data
  createdAt: string;
  updatedAt: string;
}

/**
 * Specific configuration types
 */
export interface ModelConfiguration {
  provider: 'anthropic' | 'google';
  model: string;
}

export interface RateLimitConfiguration {
  questionsPerMinute: number;
  questionsPerDayFree: number;
  documentsPerMonthFree: number;
  tasksPerMonthFree: number;
  documentsPerMonthPremium: number;
}

export interface ContextConfiguration {
  maxRecentMessages: number;
  enableSummarization: boolean;
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Create conversation request
 */
export interface CreateConversationRequest {
  title?: string;
  consultantRole?: ConsultantRole;
}

/**
 * Update conversation request
 */
export interface UpdateConversationRequest {
  title?: string;
  consultantRole?: ConsultantRole;
  status?: ConversationStatus;
}

/**
 * Send message request
 */
export interface SendMessageRequest {
  content: string;
  documentIds?: string[];
}

/**
 * Send message response (for streaming)
 */
export interface SendMessageResponse {
  message: Message;
  stream?: ReadableStream; // SSE stream for AI response
}

/**
 * Update task status request
 */
export interface UpdateTaskStatusRequest {
  approvalStatus: ApprovalStatus;
}

/**
 * List conversations query params
 */
export interface ListConversationsParams {
  status?: ConversationStatus;
  consultantRole?: ConsultantRole;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
}

/**
 * List conversations response
 */
export interface ListConversationsResponse {
  conversations: ConversationWithStats[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * List messages query params
 */
export interface ListMessagesParams {
  limit?: number;
  before?: string; // message ID for cursor-based pagination
}

/**
 * List tasks query params
 */
export interface ListTasksParams {
  approvalStatus?: ApprovalStatus;
  taskType?: TaskType;
  limit?: number;
  offset?: number;
}

/**
 * List tasks response
 */
export interface ListTasksResponse {
  tasks: TaskWithDetails[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Upload document request
 */
export interface UploadDocumentRequest {
  conversationId: string;
  messageId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

/**
 * Get usage stats query params
 */
export interface GetUsageStatsParams {
  period?: 'today' | 'month';
}

/**
 * Get usage stats response
 */
export interface GetUsageStatsResponse {
  stats: UsageStats;
  limits: UsageLimits;
}

/**
 * List audit logs query params
 */
export interface ListAuditLogsParams {
  userId?: string;
  conversationId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * List audit logs response
 */
export interface ListAuditLogsResponse {
  logs: AuditLogWithUser[];
  total: number;
  limit: number;
  offset: number;
}
