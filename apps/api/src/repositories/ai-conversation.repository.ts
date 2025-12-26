/**
 * AI Conversation Repository
 * Handles data access for AI conversations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';
import type {
  Conversation,
  ConversationWithStats,
  ConversationStatus,
  ConsultantRole,
} from '@erp-saas/shared';

type ConversationRow = Database['public']['Tables']['ai_conversations']['Row'];
type ConversationInsert = Database['public']['Tables']['ai_conversations']['Insert'];
type ConversationUpdate = Database['public']['Tables']['ai_conversations']['Update'];

/**
 * Extended query options for conversations
 */
export interface ConversationQueryOptions extends QueryOptions {
  status?: ConversationStatus;
  consultantRole?: ConsultantRole;
  userId?: string;
  includeDeleted?: boolean;
}

/**
 * Repository for AI Conversation entity
 */
export class AIConversationRepository extends BaseRepository<
  'ai_conversations',
  ConversationRow,
  ConversationInsert,
  ConversationUpdate
> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ai_conversations');
  }

  protected hasIsActiveColumn(): boolean {
    return false; // Conversations use deleted_at for soft delete
  }

  /**
   * Find all conversations with optional filters
   */
  async findAllWithFilters(
    options: ConversationQueryOptions
  ): Promise<QueryResult<Conversation>> {
    const {
      tenantId,
      page = 1,
      limit = 20,
      sort_by = 'updated_at',
      sort_order = 'desc',
      status,
      consultantRole,
      userId,
      includeDeleted = false,
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('ai_conversations')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Filter by user if specified
    if (userId) {
      query = query.eq('user_id', userId);
    }

    // Filter by status if specified
    if (status) {
      query = query.eq('status', status);
    }

    // Filter by consultant role if specified
    if (consultantRole) {
      query = query.eq('consultant_role', consultantRole);
    }

    // Exclude deleted conversations unless explicitly requested
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    // Apply sorting and pagination
    query = query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data || []) as Conversation[],
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find conversations with message count and last message timestamp
   */
  async findAllWithStats(
    options: ConversationQueryOptions
  ): Promise<QueryResult<ConversationWithStats>> {
    const {
      tenantId,
      page = 1,
      limit = 20,
      sort_by = 'updated_at',
      sort_order = 'desc',
      status,
      consultantRole,
      userId,
      includeDeleted = false,
    } = options;

    const offset = (page - 1) * limit;

    // Build query with message stats
    let query = this.supabase
      .from('ai_conversations')
      .select(
        `
        *,
        messages:ai_messages(count),
        last_message:ai_messages(created_at)
      `,
        { count: 'exact' }
      )
      .eq('tenant_id', tenantId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (consultantRole) {
      query = query.eq('consultant_role', consultantRole);
    }

    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    query = query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    // Transform data to include stats
    const conversationsWithStats: ConversationWithStats[] = (data || []).map(
      (conv: any) => ({
        id: conv.id,
        tenantId: conv.tenant_id,
        userId: conv.user_id,
        title: conv.title,
        consultantRole: conv.consultant_role,
        status: conv.status,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        deletedAt: conv.deleted_at,
        messageCount: conv.messages?.[0]?.count || 0,
        lastMessageAt: conv.last_message?.[0]?.created_at || null,
      })
    );

    return {
      data: conversationsWithStats,
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find conversation by ID with user details
   */
  async findByIdWithUser(
    tenantId: string,
    id: string
  ): Promise<Conversation | null> {
    const { data, error } = await this.supabase
      .from('ai_conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data as Conversation;
  }

  /**
   * Soft delete a conversation
   */
  async softDelete(tenantId: string, id: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_conversations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  /**
   * Archive a conversation
   */
  async archive(tenantId: string, id: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_conversations')
      .update({ status: 'archived' })
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  /**
   * Unarchive a conversation
   */
  async unarchive(tenantId: string, id: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_conversations')
      .update({ status: 'active' })
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  /**
   * Update conversation title
   */
  async updateTitle(
    tenantId: string,
    id: string,
    title: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('ai_conversations')
      .update({ title })
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  /**
   * Update consultant role
   */
  async updateConsultantRole(
    tenantId: string,
    id: string,
    consultantRole: ConsultantRole
  ): Promise<void> {
    const { error } = await this.supabase
      .from('ai_conversations')
      .update({ consultant_role: consultantRole })
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  /**
   * Get conversation count by user
   */
  async getCountByUser(tenantId: string, userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('ai_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) {
      throw error;
    }

    return count || 0;
  }
}
