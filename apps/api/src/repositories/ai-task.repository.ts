/**
 * AI Task Repository
 * Handles data access for AI-generated tasks/transactions
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';
import type { Task, TaskType, ApprovalStatus, TaskWithDetails } from '@erp-saas/shared';

type TaskRow = Database['public']['Tables']['ai_tasks']['Row'];
type TaskInsert = Database['public']['Tables']['ai_tasks']['Insert'];
type TaskUpdate = Database['public']['Tables']['ai_tasks']['Update'];

/**
 * Extended query options for AI tasks
 */
export interface AITaskQueryOptions extends QueryOptions {
  taskType?: TaskType;
  approvalStatus?: ApprovalStatus;
  userId?: string;
  conversationId?: string;
}

/**
 * Repository for AI Task entity
 */
export class AITaskRepository extends BaseRepository<
  'ai_tasks',
  TaskRow,
  TaskInsert,
  TaskUpdate
> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ai_tasks');
  }

  protected hasIsActiveColumn(): boolean {
    return false; // Tasks don't have is_active
  }

  /**
   * Find all tasks with optional filters
   */
  async findAllWithFilters(
    options: AITaskQueryOptions
  ): Promise<QueryResult<Task>> {
    const {
      tenantId,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
      taskType,
      approvalStatus,
      userId,
      conversationId,
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('ai_tasks')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (taskType) {
      query = query.eq('task_type', taskType);
    }

    if (approvalStatus) {
      query = query.eq('approval_status', approvalStatus);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
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
      data: (data || []) as Task[],
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find tasks with conversation and user details
   */
  async findAllWithDetails(
    options: AITaskQueryOptions
  ): Promise<QueryResult<TaskWithDetails>> {
    const {
      tenantId,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
      taskType,
      approvalStatus,
      userId,
      conversationId,
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('ai_tasks')
      .select(
        `
        *,
        conversation:ai_conversations(id, title),
        user:users(id, full_name, email)
      `,
        { count: 'exact' }
      )
      .eq('tenant_id', tenantId);

    if (taskType) {
      query = query.eq('task_type', taskType);
    }

    if (approvalStatus) {
      query = query.eq('approval_status', approvalStatus);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    query = query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data || []) as TaskWithDetails[],
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Create a new task
   * @param task - Task data to insert
   * @returns Created task
   */
  async createTask(task: TaskInsert): Promise<Task> {
    const { data, error } = await this.supabase
      .from('ai_tasks')
      .insert(task)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as Task;
  }

  /**
   * Update task approval status
   * @param tenantId - Tenant ID
   * @param id - Task ID
   * @param approvalStatus - New approval status
   * @returns Updated task
   */
  async updateApprovalStatus(
    tenantId: string,
    id: string,
    approvalStatus: ApprovalStatus
  ): Promise<Task> {
    const updateData: any = { approval_status: approvalStatus };

    // If marking as executed, set executed_at
    if (approvalStatus === 'executed') {
      updateData.executed_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('ai_tasks')
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as Task;
  }

  /**
   * Mark task as executed
   * @param tenantId - Tenant ID
   * @param id - Task ID
   * @param resultId - ID of the created transaction
   * @returns Updated task
   */
  async markAsExecuted(
    tenantId: string,
    id: string,
    resultId: string
  ): Promise<Task> {
    const { data, error } = await this.supabase
      .from('ai_tasks')
      .update({
        approval_status: 'executed',
        executed_at: new Date().toISOString(),
        result_id: resultId,
      })
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as Task;
  }

  /**
   * Get pending tasks for a user
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @returns Array of pending tasks
   */
  async getPendingTasks(tenantId: string, userId: string): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from('ai_tasks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as Task[];
  }

  /**
   * Get task count by approval status
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param approvalStatus - Approval status
   * @returns Task count
   */
  async getCountByStatus(
    tenantId: string,
    userId: string,
    approvalStatus: ApprovalStatus
  ): Promise<number> {
    const { count, error } = await this.supabase
      .from('ai_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('approval_status', approvalStatus);

    if (error) {
      throw error;
    }

    return count || 0;
  }

  /**
   * Get tasks for a conversation
   * @param conversationId - Conversation ID
   * @returns Array of tasks
   */
  async getTasksByConversation(conversationId: string): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from('ai_tasks')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true});

    if (error) {
      throw error;
    }

    return (data || []) as Task[];
  }

  /**
   * Delete tasks by conversation
   * @param conversationId - Conversation ID
   */
  async deleteByConversation(conversationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_tasks')
      .delete()
      .eq('conversation_id', conversationId);

    if (error) {
      throw error;
    }
  }

  /**
   * Find task by ID
   * @param id - Task ID
   * @returns Task or null
   */
  async findById(id: string): Promise<Task | null> {
    const { data, error } = await this.supabase
      .from('ai_tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data as Task;
  }

  /**
   * Find task by ID with details
   * @param id - Task ID
   * @returns Task with details or null
   */
  async findByIdWithDetails(id: string): Promise<TaskWithDetails | null> {
    const { data, error } = await this.supabase
      .from('ai_tasks')
      .select(
        `
        *,
        conversation:ai_conversations(id, title),
        user:users(id, full_name, email)
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data as TaskWithDetails;
  }

  /**
   * Find many tasks with details using filters
   * @param filters - Filter conditions
   * @param limit - Limit
   * @param offset - Offset
   * @returns Tasks with details and count
   */
  async findManyWithDetails(
    filters: Record<string, any>,
    limit: number,
    offset: number
  ): Promise<{ data: TaskWithDetails[]; count: number | null }> {
    let query = this.supabase
      .from('ai_tasks')
      .select(
        `
        *,
        conversation:ai_conversations(id, title),
        user:users(id, full_name, email)
      `,
        { count: 'exact' }
      );

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    // Apply pagination and sorting
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data || []) as TaskWithDetails[],
      count,
    };
  }

  /**
   * Update task fields
   * @param id - Task ID
   * @param updates - Fields to update
   * @returns Updated task or null
   */
  async updateTask(id: string, updates: Partial<TaskUpdate>): Promise<Task | null> {
    const { data, error } = await this.supabase
      .from('ai_tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data as Task;
  }
}
