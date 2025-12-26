/**
 * Zod validation schemas for AI Agent entities
 * @module validation/ai
 */

import { z } from 'zod';

// =============================================================================
// ENUM SCHEMAS
// =============================================================================

/**
 * Consultant role validation
 */
export const consultantRoleSchema = z.enum([
  'general',
  'marketing',
  'legal',
  'customer_service',
  'financial_analyst',
]);

/**
 * Conversation status validation
 */
export const conversationStatusSchema = z.enum(['active', 'archived']);

/**
 * Message role validation
 */
export const messageRoleSchema = z.enum(['user', 'assistant', 'system']);

/**
 * Processing status validation
 */
export const processingStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);

/**
 * Task type validation
 */
export const taskTypeSchema = z.enum([
  'invoice',
  'purchase_order',
  'sales_order',
  'payment',
  'journal_entry',
]);

/**
 * Approval status validation
 */
export const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'executed']);

/**
 * Usage action type validation
 */
export const usageActionTypeSchema = z.enum(['question', 'document', 'task']);

/**
 * Model provider validation
 */
export const modelProviderSchema = z.enum(['anthropic', 'google']);

/**
 * AI model validation
 */
export const aiModelSchema = z.enum([
  'claude-opus-4-5',
  'claude-sonnet-4-5',
  'claude-haiku-4',
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
]);

// =============================================================================
// CONVERSATION SCHEMAS
// =============================================================================

/**
 * Schema for creating a conversation
 */
export const createConversationSchema = z.object({
  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must be 200 characters or less')
    .optional(),
  consultantRole: consultantRoleSchema.default('general'),
});

/**
 * Schema for updating a conversation
 */
export const updateConversationSchema = z.object({
  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must be 200 characters or less')
    .optional(),
  consultantRole: consultantRoleSchema.optional(),
  status: conversationStatusSchema.optional(),
});

/**
 * Schema for listing conversations
 */
export const listConversationsSchema = z.object({
  status: conversationStatusSchema.optional(),
  consultantRole: consultantRoleSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'updatedAt']).default('updatedAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
});

// =============================================================================
// MESSAGE SCHEMAS
// =============================================================================

/**
 * Schema for sending a message
 */
export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content cannot be empty')
    .max(100000, 'Message must be 100,000 characters or less'),
  documentIds: z
    .array(z.string().uuid('Invalid document ID'))
    .max(10, 'Maximum 10 documents per message')
    .optional(),
});

/**
 * Schema for listing messages
 */
export const listMessagesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().uuid('Invalid message ID').optional(), // Cursor-based pagination
});

// =============================================================================
// DOCUMENT SCHEMAS
// =============================================================================

/**
 * Allowed document MIME types
 */
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
] as const;

/**
 * Schema for uploading a document
 */
export const uploadDocumentSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  messageId: z.string().uuid('Invalid message ID').optional(),
  fileName: z
    .string()
    .min(1, 'File name cannot be empty')
    .max(255, 'File name must be 255 characters or less'),
  fileType: z.enum(ALLOWED_FILE_TYPES, {
    errorMap: () => ({ message: 'File type must be PDF, PNG, or JPEG' }),
  }),
  fileSize: z
    .number()
    .int()
    .min(1, 'File size must be greater than 0')
    .max(10485760, 'File size must not exceed 10MB'),
});

// =============================================================================
// TASK SCHEMAS
// =============================================================================

/**
 * Schema for updating task status
 */
export const updateTaskStatusSchema = z.object({
  approvalStatus: approvalStatusSchema,
});

/**
 * Schema for listing tasks
 */
export const listTasksSchema = z.object({
  approvalStatus: approvalStatusSchema.optional(),
  taskType: taskTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Schema for task generated data (invoice)
 */
export const taskGeneratedDataInvoiceSchema = z.object({
  type: z.enum(['sales_invoice', 'purchase_invoice']),
  partyId: z.string().uuid('Invalid party ID').optional(),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  items: z
    .array(
      z.object({
        itemId: z.string().uuid('Invalid item ID'),
        quantity: z.number().positive('Quantity must be positive'),
        unitPrice: z.number().min(0, 'Unit price cannot be negative'),
        discountPercent: z.number().min(0).max(100).default(0),
        taxRate: z.number().min(0).max(100).default(0),
      })
    )
    .min(1, 'At least one item is required'),
  notes: z.string().max(1000).optional(),
  currency: z.string().length(3, 'Currency must be 3-letter code').optional(),
});

/**
 * Schema for task generated data (payment)
 */
export const taskGeneratedDataPaymentSchema = z.object({
  partyId: z.string().uuid('Invalid party ID'),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'check']),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

/**
 * Schema for task generated data (journal entry)
 */
export const taskGeneratedDataJournalEntrySchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  entries: z
    .array(
      z.object({
        accountId: z.string().uuid('Invalid account ID'),
        debit: z.number().min(0, 'Debit cannot be negative').default(0),
        credit: z.number().min(0, 'Credit cannot be negative').default(0),
        description: z.string().max(200).optional(),
      })
    )
    .min(2, 'At least two entries are required'),
  reference: z.string().max(100).optional(),
});

// =============================================================================
// USAGE SCHEMAS
// =============================================================================

/**
 * Schema for getting usage stats
 */
export const getUsageStatsSchema = z.object({
  period: z.enum(['today', 'month']).default('today'),
});

// =============================================================================
// AUDIT LOG SCHEMAS
// =============================================================================

/**
 * Schema for listing audit logs
 */
export const listAuditLogsSchema = z.object({
  userId: z.string().uuid('Invalid user ID').optional(),
  conversationId: z.string().uuid('Invalid conversation ID').optional(),
  action: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Schema for creating audit log
 */
export const createAuditLogSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID').optional(),
  action: z.string().min(1, 'Action cannot be empty').max(200),
  prompt: z.string().max(100000).optional(),
  response: z.string().max(10000).optional(),
  dataAccessed: z.record(z.any()).optional(),
  permissions: z.array(z.string()).optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().max(500).optional(),
});

// =============================================================================
// CONFIGURATION SCHEMAS
// =============================================================================

/**
 * Schema for AI model configuration
 */
export const aiModelConfigSchema = z.object({
  provider: modelProviderSchema,
  model: aiModelSchema,
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
});

/**
 * Schema for rate limit configuration
 */
export const rateLimitConfigSchema = z.object({
  questionsPerMinute: z.number().int().positive(),
  questionsPerDayFree: z.number().int().positive(),
  documentsPerMonthFree: z.number().int().positive(),
  tasksPerMonthFree: z.number().int().positive(),
  documentsPerMonthPremium: z.number().int().positive(),
});

/**
 * Schema for context configuration
 */
export const contextConfigSchema = z.object({
  maxRecentMessages: z.number().int().positive(),
  enableSummarization: z.boolean(),
});

/**
 * Schema for configuration key validation
 */
export const configKeySchema = z
  .string()
  .regex(/^[a-z_]+$/, 'Config key must contain only lowercase letters and underscores');

/**
 * Schema for creating/updating configuration
 */
export const upsertConfigurationSchema = z.object({
  configKey: configKeySchema,
  configValue: z.record(z.any()),
});

// =============================================================================
// ADMIN SCHEMAS
// =============================================================================

/**
 * Schema for admin usage statistics query
 */
export const adminUsageStatsSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID').optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

/**
 * Schema for disabling AI for tenant
 */
export const disableTenantAISchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

// =============================================================================
// EXPORT INFERRED TYPES
// =============================================================================

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type ListConversationsInput = z.infer<typeof listConversationsSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ListMessagesInput = z.infer<typeof listMessagesSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type ListTasksInput = z.infer<typeof listTasksSchema>;
export type GetUsageStatsInput = z.infer<typeof getUsageStatsSchema>;
export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>;
export type CreateAuditLogInput = z.infer<typeof createAuditLogSchema>;
export type UpsertConfigurationInput = z.infer<typeof upsertConfigurationSchema>;
export type AdminUsageStatsInput = z.infer<typeof adminUsageStatsSchema>;
export type DisableTenantAIInput = z.infer<typeof disableTenantAISchema>;
