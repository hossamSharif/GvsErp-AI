/**
 * AI Task Service
 * Handles AI-generated task management and execution
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import type {
  Task,
  TaskWithDetails,
  TaskType,
  ApprovalStatus,
  UserContext,
  ListTasksParams,
  ListTasksResponse,
} from '@erp-saas/shared';
import { AITaskRepository } from '../repositories/ai-task.repository';
import { AIUsageRepository } from '../repositories/ai-usage.repository';

/**
 * Create task options
 */
export interface CreateTaskOptions {
  userContext: UserContext;
  conversationId: string;
  messageId: string;
  taskType: TaskType;
  generatedData: Record<string, any>;
}

/**
 * Update task status options
 */
export interface UpdateTaskStatusOptions {
  userContext: UserContext;
  taskId: string;
  approvalStatus: ApprovalStatus;
}

/**
 * Execute task options
 */
export interface ExecuteTaskOptions {
  userContext: UserContext;
  taskId: string;
}

/**
 * AI Task Service
 * Manages AI-generated tasks (invoices, payments, etc.)
 */
export class AITaskService {
  private taskRepo: AITaskRepository;
  private usageRepo: AIUsageRepository;

  constructor(private supabase: SupabaseClient<Database>) {
    this.taskRepo = new AITaskRepository(supabase);
    this.usageRepo = new AIUsageRepository(supabase);
  }

  /**
   * Create a new AI-generated task
   * @param options - Task creation options
   * @returns Created task
   */
  async create(options: CreateTaskOptions): Promise<Task> {
    const { userContext, conversationId, messageId, taskType, generatedData } = options;

    // Create task record
    const task = await this.taskRepo.createTask({
      tenant_id: userContext.tenantId,
      user_id: userContext.userId,
      conversation_id: conversationId,
      message_id: messageId,
      task_type: taskType,
      generated_data: generatedData,
      approval_status: 'pending',
    });

    // Track usage
    await this.trackTaskUsage(userContext, conversationId);

    return task;
  }

  /**
   * List tasks with filters
   * @param userContext - User context
   * @param params - Query parameters
   * @returns List of tasks with pagination
   */
  async list(
    userContext: UserContext,
    params: ListTasksParams = {}
  ): Promise<ListTasksResponse> {
    const {
      approvalStatus,
      taskType,
      limit = 50,
      offset = 0,
    } = params;

    // Build filter conditions
    const filters: Record<string, any> = {
      tenant_id: userContext.tenantId,
      user_id: userContext.userId,
    };

    if (approvalStatus) {
      filters.approval_status = approvalStatus;
    }

    if (taskType) {
      filters.task_type = taskType;
    }

    // Get tasks with pagination
    const { data: tasks, count } = await this.taskRepo.findManyWithDetails(
      filters,
      limit,
      offset
    );

    return {
      tasks: tasks as TaskWithDetails[],
      total: count || 0,
      limit,
      offset,
    };
  }

  /**
   * Get a specific task by ID
   * @param userContext - User context
   * @param taskId - Task ID
   * @returns Task with details
   */
  async get(userContext: UserContext, taskId: string): Promise<TaskWithDetails> {
    const task = await this.taskRepo.findByIdWithDetails(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // Verify ownership
    if (task.tenantId !== userContext.tenantId || task.userId !== userContext.userId) {
      throw new Error('Unauthorized access to task');
    }

    return task as TaskWithDetails;
  }

  /**
   * Update task approval status
   * @param options - Update options
   * @returns Updated task
   */
  async updateStatus(options: UpdateTaskStatusOptions): Promise<Task> {
    const { userContext, taskId, approvalStatus } = options;

    // Get existing task
    const existingTask = await this.taskRepo.findById(taskId);

    if (!existingTask) {
      throw new Error('Task not found');
    }

    // Verify ownership
    if (
      existingTask.tenant_id !== userContext.tenantId ||
      existingTask.user_id !== userContext.userId
    ) {
      throw new Error('Unauthorized access to task');
    }

    // Validate status transition
    this.validateStatusTransition(existingTask.approval_status, approvalStatus);

    // Update task status
    const updatedTask = await this.taskRepo.updateTask(taskId, {
      approval_status: approvalStatus,
    });

    if (!updatedTask) {
      throw new Error('Failed to update task status');
    }

    return updatedTask;
  }

  /**
   * Execute an approved task
   * This method prepares the task for execution but doesn't actually create
   * the transaction - that's done on the frontend when the user submits the form
   * @param options - Execute options
   * @returns Task execution data for frontend
   */
  async execute(options: ExecuteTaskOptions): Promise<{
    task: Task;
    redirectUrl: string;
    formData: Record<string, any>;
  }> {
    const { userContext, taskId } = options;

    // Get task
    const task = await this.taskRepo.findById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // Verify ownership
    if (task.tenant_id !== userContext.tenantId || task.user_id !== userContext.userId) {
      throw new Error('Unauthorized access to task');
    }

    // Verify task is approved
    if (task.approval_status !== 'approved') {
      throw new Error('Task must be approved before execution');
    }

    // Build redirect URL based on task type
    const redirectUrl = this.buildRedirectUrl(task.task_type);

    // Return task and execution data
    return {
      task,
      redirectUrl,
      formData: task.generated_data as Record<string, any>,
    };
  }

  /**
   * Mark task as executed with result ID
   * @param taskId - Task ID
   * @param resultId - ID of created transaction
   */
  async markAsExecuted(taskId: string, resultId: string): Promise<Task> {
    const updatedTask = await this.taskRepo.updateTask(taskId, {
      approval_status: 'executed',
      executed_at: new Date().toISOString(),
      result_id: resultId,
    });

    if (!updatedTask) {
      throw new Error('Failed to mark task as executed');
    }

    return updatedTask;
  }

  /**
   * Validate status transition
   * @param currentStatus - Current approval status
   * @param newStatus - New approval status
   */
  private validateStatusTransition(
    currentStatus: ApprovalStatus,
    newStatus: ApprovalStatus
  ): void {
    const validTransitions: Record<ApprovalStatus, ApprovalStatus[]> = {
      pending: ['approved', 'rejected'],
      approved: ['executed', 'rejected'],
      rejected: ['pending'], // Allow re-submission
      executed: [], // Cannot change once executed
    };

    const allowedTransitions = validTransitions[currentStatus];

    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Build redirect URL for task type
   * @param taskType - Type of task
   * @returns Frontend URL for form page
   */
  private buildRedirectUrl(taskType: TaskType): string {
    const baseUrl = '/'; // Relative URL for frontend navigation

    const urlMap: Record<TaskType, string> = {
      invoice: `${baseUrl}sales/new`,
      purchase_order: `${baseUrl}purchases/new`,
      sales_order: `${baseUrl}sales/new`,
      payment: `${baseUrl}payments/new`,
      journal_entry: `${baseUrl}accounting/journal/new`,
    };

    return urlMap[taskType] || baseUrl;
  }

  /**
   * Track task usage for tier limits
   * @param userContext - User context
   * @param conversationId - Conversation ID
   */
  private async trackTaskUsage(
    userContext: UserContext,
    conversationId: string
  ): Promise<void> {
    try {
      await this.usageRepo.trackUsage({
        tenant_id: userContext.tenantId,
        user_id: userContext.userId,
        conversation_id: conversationId,
        action_type: 'task',
        model_used: 'task-generation',
        tokens_used: 0, // Tasks don't consume tokens directly
        cost_estimate: '0',
      });
    } catch (error) {
      console.error('Error tracking task usage:', error);
      // Don't fail the request if usage tracking fails
    }
  }
}
