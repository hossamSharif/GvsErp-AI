/**
 * AI Tasks Routes
 * API endpoints for AI-generated tasks management
 */

import { Router, type Request, type Response } from 'express';
import { updateTaskStatusSchema } from '@erp-saas/shared/validation';
import { AITaskService } from '../services/ai-task.service';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { validateRequest } from '../middleware/validate';
import type { UserContext, ListTasksParams, ApprovalStatus, TaskType } from '@erp-saas/shared';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Get user context from request
 */
function getUserContext(req: Request): UserContext {
  const user = req.user!;
  if (!user || !user.id || !user.tenant_id) {
    throw new Error('User context not found');
  }
  return {
    userId: user.id,
    tenantId: user.tenant_id,
    permissions: user.permissions || [],
    locale: 'en',
  };
}

/**
 * GET /api/ai/tasks
 * List AI-generated tasks with filters
 */
router.get(
  '/',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userContext = getUserContext(req);
      const { supabase } = getTenantContext(req);
      const taskService = new AITaskService(supabase);

      // Parse query parameters
      const params: ListTasksParams = {
        approvalStatus: req.query.approvalStatus as ApprovalStatus | undefined,
        taskType: req.query.taskType as TaskType | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      const result = await taskService.list(userContext, params);

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Error listing tasks:', error);
      res.status(500).json({
        error: 'Failed to list tasks',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/ai/tasks/:id
 * Get task details by ID
 */
router.get(
  '/:id',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userContext = getUserContext(req);
      const { supabase } = getTenantContext(req);
      const taskService = new AITaskService(supabase);

      const task = await taskService.get(userContext, id);

      res.status(200).json(task);
    } catch (error: any) {
      console.error('Error getting task:', error);

      if (error.message === 'Task not found') {
        res.status(404).json({
          error: 'Task not found',
          message: error.message,
        });
        return;
      }

      if (error.message === 'Unauthorized access to task') {
        res.status(403).json({
          error: 'Unauthorized',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to get task',
        message: error.message,
      });
    }
  }
);

/**
 * PATCH /api/ai/tasks/:id
 * Update task approval status
 */
router.patch(
  '/:id',
  validateRequest(updateTaskStatusSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { approvalStatus } = req.body;
      const userContext = getUserContext(req);
      const { supabase } = getTenantContext(req);
      const taskService = new AITaskService(supabase);

      const updatedTask = await taskService.updateStatus({
        userContext,
        taskId: id,
        approvalStatus,
      });

      res.status(200).json(updatedTask);
    } catch (error: any) {
      console.error('Error updating task status:', error);

      if (error.message === 'Task not found') {
        res.status(404).json({
          error: 'Task not found',
          message: error.message,
        });
        return;
      }

      if (error.message === 'Unauthorized access to task') {
        res.status(403).json({
          error: 'Unauthorized',
          message: error.message,
        });
        return;
      }

      if (error.message.includes('Invalid status transition')) {
        res.status(400).json({
          error: 'Invalid status transition',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to update task status',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/ai/tasks/:id/execute
 * Execute an approved task (prepare for frontend navigation)
 */
router.post(
  '/:id/execute',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userContext = getUserContext(req);
      const { supabase } = getTenantContext(req);
      const taskService = new AITaskService(supabase);

      const result = await taskService.execute({
        userContext,
        taskId: id,
      });

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Error executing task:', error);

      if (error.message === 'Task not found') {
        res.status(404).json({
          error: 'Task not found',
          message: error.message,
        });
        return;
      }

      if (error.message === 'Unauthorized access to task') {
        res.status(403).json({
          error: 'Unauthorized',
          message: error.message,
        });
        return;
      }

      if (error.message === 'Task must be approved before execution') {
        res.status(400).json({
          error: 'Task not approved',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to execute task',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/ai/tasks/:id/mark-executed
 * Mark task as executed with result ID (called after frontend creates the transaction)
 */
router.post(
  '/:id/mark-executed',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { resultId } = req.body;
      const userContext = getUserContext(req);
      const { supabase } = getTenantContext(req);
      const taskService = new AITaskService(supabase);

      if (!resultId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'resultId is required',
        });
        return;
      }

      // Verify task belongs to user
      const task = await taskService.get(userContext, id);

      if (!task) {
        res.status(404).json({
          error: 'Task not found',
        });
        return;
      }

      const updatedTask = await taskService.markAsExecuted(id, resultId);

      res.status(200).json(updatedTask);
    } catch (error: any) {
      console.error('Error marking task as executed:', error);

      res.status(500).json({
        error: 'Failed to mark task as executed',
        message: error.message,
      });
    }
  }
);

export default router;
