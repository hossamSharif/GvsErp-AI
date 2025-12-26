/**
 * AI Conversation Service
 * Handles CRUD operations and lifecycle management for conversations
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import type {
  Conversation,
  ConversationWithStats,
  CreateConversationRequest,
  UpdateConversationRequest,
  ConsultantRole,
  ConversationStatus,
  QueryResult,
} from '@erp-saas/shared';
import { AIConversationRepository } from '../repositories/ai-conversation.repository';
import { AIMessageRepository } from '../repositories/ai-message.repository';
import { AIDocumentRepository } from '../repositories/ai-document.repository';
import { AITaskRepository } from '../repositories/ai-task.repository';
import { AIAgentService } from './ai-agent.service';

/**
 * Query options for listing conversations
 */
export interface ListConversationsOptions {
  tenantId: string;
  userId?: string;
  status?: ConversationStatus;
  consultantRole?: ConsultantRole;
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
}

/**
 * AI Conversation Service
 * Manages conversation lifecycle and operations
 */
export class AIConversationService {
  private conversationRepo: AIConversationRepository;
  private messageRepo: AIMessageRepository;
  private documentRepo: AIDocumentRepository;
  private taskRepo: AITaskRepository;
  private agentService: AIAgentService;

  constructor(private supabase: SupabaseClient<Database>) {
    this.conversationRepo = new AIConversationRepository(supabase);
    this.messageRepo = new AIMessageRepository(supabase);
    this.documentRepo = new AIDocumentRepository(supabase);
    this.taskRepo = new AITaskRepository(supabase);
    this.agentService = new AIAgentService(supabase);
  }

  /**
   * Create a new conversation
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param data - Conversation data
   * @returns Created conversation
   */
  async createConversation(
    tenantId: string,
    userId: string,
    data: CreateConversationRequest
  ): Promise<Conversation> {
    const conversation = await this.conversationRepo.createConversation({
      tenant_id: tenantId,
      user_id: userId,
      title: data.title || 'New Conversation',
      consultant_role: data.consultantRole || 'general',
      status: 'active',
    });

    return conversation;
  }

  /**
   * Get conversation by ID
   * @param tenantId - Tenant ID
   * @param id - Conversation ID
   * @returns Conversation or null
   */
  async getConversation(
    tenantId: string,
    id: string
  ): Promise<Conversation | null> {
    return this.conversationRepo.findById(tenantId, id);
  }

  /**
   * Get conversation with statistics
   * @param tenantId - Tenant ID
   * @param id - Conversation ID
   * @returns Conversation with stats or null
   */
  async getConversationWithStats(
    tenantId: string,
    id: string
  ): Promise<ConversationWithStats | null> {
    const result = await this.conversationRepo.findAllWithStats({
      tenantId,
      limit: 1,
      conversationId: id,
    });

    return result.data[0] || null;
  }

  /**
   * List conversations with optional filters
   * @param options - Query options
   * @returns Paginated conversations with stats
   */
  async listConversations(
    options: ListConversationsOptions
  ): Promise<QueryResult<ConversationWithStats>> {
    return this.conversationRepo.findAllWithStats({
      tenantId: options.tenantId,
      userId: options.userId,
      status: options.status,
      consultantRole: options.consultantRole,
      page: options.page || 1,
      limit: options.limit || 20,
      includeDeleted: options.includeDeleted || false,
    });
  }

  /**
   * Update conversation
   * @param tenantId - Tenant ID
   * @param id - Conversation ID
   * @param data - Update data
   * @returns Updated conversation
   */
  async updateConversation(
    tenantId: string,
    id: string,
    data: UpdateConversationRequest
  ): Promise<Conversation> {
    const updateData: any = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    if (data.consultantRole !== undefined) {
      updateData.consultant_role = data.consultantRole;
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    const conversation = await this.conversationRepo.update(tenantId, id, updateData);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return conversation;
  }

  /**
   * Archive conversation
   * @param tenantId - Tenant ID
   * @param id - Conversation ID
   * @returns Updated conversation
   */
  async archiveConversation(
    tenantId: string,
    id: string
  ): Promise<Conversation> {
    return this.updateConversation(tenantId, id, { status: 'archived' });
  }

  /**
   * Restore archived conversation
   * @param tenantId - Tenant ID
   * @param id - Conversation ID
   * @returns Updated conversation
   */
  async restoreConversation(
    tenantId: string,
    id: string
  ): Promise<Conversation> {
    return this.updateConversation(tenantId, id, { status: 'active' });
  }

  /**
   * Soft delete conversation
   * @param tenantId - Tenant ID
   * @param id - Conversation ID
   */
  async deleteConversation(tenantId: string, id: string): Promise<void> {
    await this.conversationRepo.softDelete(tenantId, id);
  }

  /**
   * Permanently delete conversation and all related data
   * @param tenantId - Tenant ID
   * @param id - Conversation ID
   */
  async permanentlyDeleteConversation(
    tenantId: string,
    id: string
  ): Promise<void> {
    // Delete related data first
    await this.taskRepo.deleteByConversation(id);
    await this.documentRepo.deleteByConversation(id);
    await this.messageRepo.deleteByConversation(id);

    // Delete conversation
    await this.conversationRepo.delete(tenantId, id);
  }

  /**
   * Auto-generate conversation title from first message
   * @param tenantId - Tenant ID
   * @param conversationId - Conversation ID
   */
  async autoGenerateTitle(
    tenantId: string,
    conversationId: string
  ): Promise<void> {
    // Get first user message
    const messages = await this.messageRepo.findByConversation(conversationId, 1);
    const firstUserMessage = messages.find((m) => m.role === 'user');

    if (!firstUserMessage) {
      return;
    }

    // Generate title
    const title = await this.agentService.generateConversationTitle(
      firstUserMessage.content
    );

    // Update conversation
    await this.updateConversation(tenantId, conversationId, { title });
  }

  /**
   * Get conversation messages
   * @param conversationId - Conversation ID
   * @param limit - Maximum messages to return
   * @param before - Cursor for pagination
   * @returns Array of messages
   */
  async getMessages(
    conversationId: string,
    limit: number = 50,
    before?: string
  ) {
    return this.messageRepo.findByConversation(conversationId, limit, before);
  }

  /**
   * Get conversation documents
   * @param conversationId - Conversation ID
   * @returns Array of documents
   */
  async getDocuments(conversationId: string) {
    return this.documentRepo.getDocumentsByConversation(conversationId);
  }

  /**
   * Get conversation tasks
   * @param conversationId - Conversation ID
   * @returns Array of tasks
   */
  async getTasks(conversationId: string) {
    return this.taskRepo.getTasksByConversation(conversationId);
  }

  /**
   * Get conversations that need cleanup (soft deleted > 90 days ago)
   * @param tenantId - Tenant ID
   * @returns Array of conversation IDs
   */
  async getConversationsForCleanup(tenantId: string): Promise<string[]> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data, error } = await this.supabase
      .from('ai_conversations')
      .select('id')
      .eq('tenant_id', tenantId)
      .not('deleted_at', 'is', null)
      .lt('deleted_at', ninetyDaysAgo.toISOString());

    if (error) {
      throw error;
    }

    return (data || []).map((c) => c.id);
  }

  /**
   * Bulk cleanup old conversations
   * @param tenantId - Tenant ID
   * @returns Number of conversations deleted
   */
  async cleanupOldConversations(tenantId: string): Promise<number> {
    const conversationIds = await this.getConversationsForCleanup(tenantId);

    for (const id of conversationIds) {
      await this.permanentlyDeleteConversation(tenantId, id);
    }

    return conversationIds.length;
  }

  /**
   * Get conversation count by status
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param status - Conversation status
   * @returns Count
   */
  async getConversationCount(
    tenantId: string,
    userId: string,
    status?: ConversationStatus
  ): Promise<number> {
    let query = this.supabase
      .from('ai_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (status) {
      query = query.eq('status', status);
    }

    const { count, error } = await query;

    if (error) {
      throw error;
    }

    return count || 0;
  }

  /**
   * Search conversations by title
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param searchTerm - Search term
   * @param limit - Maximum results
   * @returns Array of conversations
   */
  async searchConversations(
    tenantId: string,
    userId: string,
    searchTerm: string,
    limit: number = 10
  ): Promise<Conversation[]> {
    const { data, error } = await this.supabase
      .from('ai_conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .ilike('title', `%${searchTerm}%`)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data || []) as Conversation[];
  }
}
