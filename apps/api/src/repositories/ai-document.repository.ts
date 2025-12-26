/**
 * AI Document Repository
 * Handles data access for uploaded documents (PDFs, images)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';
import type { Document, ProcessingStatus } from '@erp-saas/shared';

type DocumentRow = Database['public']['Tables']['ai_documents']['Row'];
type DocumentInsert = Database['public']['Tables']['ai_documents']['Insert'];
type DocumentUpdate = Database['public']['Tables']['ai_documents']['Update'];

/**
 * Extended query options for AI documents
 */
export interface AIDocumentQueryOptions extends QueryOptions {
  conversationId?: string;
  userId?: string;
  processingStatus?: ProcessingStatus;
  fileType?: string;
}

/**
 * Repository for AI Document entity
 */
export class AIDocumentRepository extends BaseRepository<
  'ai_documents',
  DocumentRow,
  DocumentInsert,
  DocumentUpdate
> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ai_documents');
  }

  protected hasIsActiveColumn(): boolean {
    return false; // Documents don't have is_active
  }

  /**
   * Find all documents with optional filters
   */
  async findAllWithFilters(
    options: AIDocumentQueryOptions
  ): Promise<QueryResult<Document>> {
    const {
      tenantId,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
      conversationId,
      userId,
      processingStatus,
      fileType,
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('ai_documents')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (processingStatus) {
      query = query.eq('processing_status', processingStatus);
    }

    if (fileType) {
      query = query.eq('file_type', fileType);
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
      data: (data || []) as Document[],
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Create a new document record
   * @param document - Document data to insert
   * @returns Created document
   */
  async createDocument(document: DocumentInsert): Promise<Document> {
    const { data, error } = await this.supabase
      .from('ai_documents')
      .insert(document)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as Document;
  }

  /**
   * Update document processing status
   * @param id - Document ID
   * @param status - New processing status
   * @param extractedText - Optional extracted text
   * @param error - Optional error message
   * @returns Updated document
   */
  async updateProcessingStatus(
    id: string,
    status: ProcessingStatus,
    extractedText?: string,
    error?: string
  ): Promise<Document> {
    const updateData: any = { processing_status: status };

    if (extractedText !== undefined) {
      updateData.extracted_text = extractedText;
    }

    if (error !== undefined) {
      updateData.processing_error = error;
    }

    const { data, error: updateError } = await this.supabase
      .from('ai_documents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return data as Document;
  }

  /**
   * Get documents by conversation
   * @param conversationId - Conversation ID
   * @returns Array of documents
   */
  async getDocumentsByConversation(
    conversationId: string
  ): Promise<Document[]> {
    const { data, error } = await this.supabase
      .from('ai_documents')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as Document[];
  }

  /**
   * Get documents by message
   * @param messageId - Message ID
   * @returns Array of documents
   */
  async getDocumentsByMessage(messageId: string): Promise<Document[]> {
    const { data, error } = await this.supabase
      .from('ai_documents')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as Document[];
  }

  /**
   * Get pending documents for processing
   * @param limit - Maximum number of documents to return
   * @returns Array of pending documents
   */
  async getPendingDocuments(limit: number = 10): Promise<Document[]> {
    const { data, error } = await this.supabase
      .from('ai_documents')
      .select('*')
      .eq('processing_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data || []) as Document[];
  }

  /**
   * Get document count by user for a period
   * Used for tier limit enforcement
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param startDate - Start date (ISO string)
   * @returns Document count
   */
  async getDocumentCountByUser(
    tenantId: string,
    userId: string,
    startDate: string
  ): Promise<number> {
    const { count, error } = await this.supabase
      .from('ai_documents')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .gte('created_at', startDate);

    if (error) {
      throw error;
    }

    return count || 0;
  }

  /**
   * Get total storage size for user's documents
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @returns Total size in bytes
   */
  async getTotalStorageSize(
    tenantId: string,
    userId: string
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from('ai_documents')
      .select('file_size')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return (data || []).reduce(
      (sum, doc) => sum + (doc.file_size || 0),
      0
    );
  }

  /**
   * Delete document record (file should be deleted from storage separately)
   * @param tenantId - Tenant ID
   * @param id - Document ID
   */
  async deleteDocument(tenantId: string, id: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_documents')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  /**
   * Delete documents by conversation
   * @param conversationId - Conversation ID
   */
  async deleteByConversation(conversationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_documents')
      .delete()
      .eq('conversation_id', conversationId);

    if (error) {
      throw error;
    }
  }

  /**
   * Get failed documents for retry
   * @param limit - Maximum number of documents to return
   * @returns Array of failed documents
   */
  async getFailedDocuments(limit: number = 10): Promise<Document[]> {
    const { data, error } = await this.supabase
      .from('ai_documents')
      .select('*')
      .eq('processing_status', 'failed')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data || []) as Document[];
  }

  /**
   * Get document by storage path
   * @param storagePath - Storage path
   * @returns Document or null
   */
  async getDocumentByPath(storagePath: string): Promise<Document | null> {
    const { data, error } = await this.supabase
      .from('ai_documents')
      .select('*')
      .eq('storage_path', storagePath)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as Document;
  }
}
