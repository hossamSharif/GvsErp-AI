/**
 * AI Message Repository
 * Handles data access for AI messages within conversations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { BaseRepository } from './base.repository';
import type { Message, MessageRole } from '@erp-saas/shared';

type MessageRow = Database['public']['Tables']['ai_messages']['Row'];
type MessageInsert = Database['public']['Tables']['ai_messages']['Insert'];
type MessageUpdate = Database['public']['Tables']['ai_messages']['Update'];

/**
 * Repository for AI Message entity
 */
export class AIMessageRepository extends BaseRepository<
  'ai_messages',
  MessageRow,
  MessageInsert,
  MessageUpdate
> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ai_messages');
  }

  protected hasIsActiveColumn(): boolean {
    return false; // Messages don't have is_active
  }

  /**
   * Find all messages in a conversation
   * @param conversationId - Conversation ID
   * @param limit - Maximum number of messages to return
   * @param before - Cursor for pagination (message ID)
   * @returns Array of messages ordered by creation time
   */
  async findByConversation(
    conversationId: string,
    limit: number = 50,
    before?: string
  ): Promise<Message[]> {
    let query = this.supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    // Cursor-based pagination
    if (before) {
      // Get messages before the cursor message
      const { data: cursorMessage } = await this.supabase
        .from('ai_messages')
        .select('created_at')
        .eq('id', before)
        .single();

      if (cursorMessage) {
        query = query.lt('created_at', cursorMessage.created_at);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data || []) as Message[];
  }

  /**
   * Find recent messages in a conversation
   * @param conversationId - Conversation ID
   * @param count - Number of recent messages to return
   * @returns Array of most recent messages
   */
  async findRecentMessages(
    conversationId: string,
    count: number = 20
  ): Promise<Message[]> {
    const { data, error } = await this.supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(count);

    if (error) {
      throw error;
    }

    // Reverse to get chronological order
    return ((data || []) as Message[]).reverse();
  }

  /**
   * Create a new message
   * @param message - Message data to insert
   * @returns Created message
   */
  async createMessage(message: MessageInsert): Promise<Message> {
    const { data, error } = await this.supabase
      .from('ai_messages')
      .insert(message)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as Message;
  }

  /**
   * Get message count for a conversation
   * @param conversationId - Conversation ID
   * @returns Total message count
   */
  async getMessageCount(conversationId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('ai_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);

    if (error) {
      throw error;
    }

    return count || 0;
  }

  /**
   * Get total token usage for a conversation
   * @param conversationId - Conversation ID
   * @returns Total tokens used
   */
  async getTotalTokens(conversationId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('ai_messages')
      .select('token_count')
      .eq('conversation_id', conversationId);

    if (error) {
      throw error;
    }

    return (data || []).reduce((sum, msg) => sum + (msg.token_count || 0), 0);
  }

  /**
   * Find messages by role
   * @param conversationId - Conversation ID
   * @param role - Message role (user, assistant, system)
   * @returns Array of messages with specified role
   */
  async findByRole(
    conversationId: string,
    role: MessageRole
  ): Promise<Message[]> {
    const { data, error } = await this.supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('role', role)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as Message[];
  }

  /**
   * Find messages with attached documents
   * @param conversationId - Conversation ID
   * @returns Array of messages that have document attachments
   */
  async findMessagesWithDocuments(
    conversationId: string
  ): Promise<Message[]> {
    const { data, error } = await this.supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .not('document_ids', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as Message[];
  }

  /**
   * Get last message in conversation
   * @param conversationId - Conversation ID
   * @returns Last message or null if no messages
   */
  async getLastMessage(conversationId: string): Promise<Message | null> {
    const { data, error } = await this.supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No messages
      }
      throw error;
    }

    return data as Message;
  }

  /**
   * Delete all messages in a conversation
   * @param conversationId - Conversation ID
   */
  async deleteByConversation(conversationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (error) {
      throw error;
    }
  }

  /**
   * Get message by ID
   * @param id - Message ID
   * @returns Message or null if not found
   */
  async findMessageById(id: string): Promise<Message | null> {
    const { data, error } = await this.supabase
      .from('ai_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as Message;
  }
}
