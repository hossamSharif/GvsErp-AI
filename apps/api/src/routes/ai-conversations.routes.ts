/**
 * AI Conversations Routes
 * Handles conversation management, messaging, and usage tracking
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  createConversationSchema,
  updateConversationSchema,
  sendMessageSchema,
} from '@erp-saas/shared/validation';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { AIConversationService } from '../services/ai-conversation.service';
import { AIAgentService } from '../services/ai-agent.service';
import { AIUsageService } from '../services/ai-usage.service';
import { checkAIUsageLimit } from '../middleware/ai-rate-limit';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * GET /api/ai/conversations
 * List conversations for current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { supabase, tenantId, userId } = getTenantContext(req);
    const { status, role, page, limit, include_deleted } = req.query;

    const service = new AIConversationService(supabase);

    const result = await service.listConversations({
      tenantId,
      userId,
      status: status as any,
      consultantRole: role as any,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
      includeDeleted: include_deleted === 'true',
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/conversations
 * Create a new conversation
 */
router.post(
  '/',
  validateRequest(createConversationSchema),
  async (req: Request, res: Response) => {
    try {
      const { supabase, tenantId, userId } = getTenantContext(req);
      const service = new AIConversationService(supabase);

      const conversation = await service.createConversation(
        tenantId,
        userId,
        req.body
      );

      res.status(201).json(conversation);
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/ai/conversations/:id
 * Get conversation by ID with stats
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { supabase, tenantId } = getTenantContext(req);
    const service = new AIConversationService(supabase);

    const conversation = await service.getConversationWithStats(
      tenantId,
      req.params.id
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error: any) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/ai/conversations/:id
 * Update conversation
 */
router.patch(
  '/:id',
  validateRequest(updateConversationSchema),
  async (req: Request, res: Response) => {
    try {
      const { supabase, tenantId } = getTenantContext(req);
      const service = new AIConversationService(supabase);

      const conversation = await service.updateConversation(
        tenantId,
        req.params.id,
        req.body
      );

      res.json(conversation);
    } catch (error: any) {
      console.error('Error updating conversation:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * DELETE /api/ai/conversations/:id
 * Soft delete conversation
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { supabase, tenantId } = getTenantContext(req);
    const service = new AIConversationService(supabase);

    await service.deleteConversation(tenantId, req.params.id);

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/conversations/:id/archive
 * Archive conversation
 */
router.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    const { supabase, tenantId } = getTenantContext(req);
    const service = new AIConversationService(supabase);

    const conversation = await service.archiveConversation(tenantId, req.params.id);

    res.json(conversation);
  } catch (error: any) {
    console.error('Error archiving conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/conversations/:id/restore
 * Restore archived conversation
 */
router.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const { supabase, tenantId } = getTenantContext(req);
    const service = new AIConversationService(supabase);

    const conversation = await service.restoreConversation(tenantId, req.params.id);

    res.json(conversation);
  } catch (error: any) {
    console.error('Error restoring conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/conversations/:id/messages
 * Get conversation messages
 */
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { supabase } = getTenantContext(req);
    const { limit, before } = req.query;
    const service = new AIConversationService(supabase);

    const messages = await service.getMessages(
      req.params.id,
      limit ? parseInt(limit as string) : 50,
      before as string | undefined
    );

    res.json({ data: messages });
  } catch (error: any) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/conversations/:id/messages
 * Send message with streaming AI response
 */
router.post(
  '/:id/messages',
  checkAIUsageLimit('question'),
  validateRequest(sendMessageSchema),
  async (req: Request, res: Response) => {
    try {
      const { supabase, tenantId, userId } = getTenantContext(req);
      const conversationId = req.params.id;
      const user = req.user!;

      // Get conversation to get consultant role
      const conversationService = new AIConversationService(supabase);
      const conversation = await conversationService.getConversation(
        tenantId,
        conversationId
      );

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Prepare user context
      const userContext = {
        tenantId,
        userId,
        userName: user.email,
        tenantName: tenantId, // We don't have tenant name in req.user, using ID
        permissions: user.permissions || [],
        locale: req.headers['accept-language']?.split(',')[0] || 'en',
        baseCurrency: 'USD', // Default currency
      };

      // Process message with streaming
      const agentService = new AIAgentService(supabase);
      const result = await agentService.processMessage({
        userContext,
        conversationId,
        consultantRole: conversation.consultantRole,
        userMessage: req.body.content,
        documentIds: req.body.documentIds,
      });

      // Auto-generate title if this is the first message
      const messages = await conversationService.getMessages(conversationId, 2);
      if (messages.length === 2) {
        // First user + assistant message
        await conversationService.autoGenerateTitle(tenantId, conversationId);
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send message ID immediately
      res.write(`data: ${JSON.stringify({ messageId: result.messageId })}\n\n`);

      // Stream AI response
      const reader = result.stream.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }

        // Send done event
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (streamError) {
        console.error('Error streaming response:', streamError);
        res.write(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`);
        res.end();
      }
    } catch (error: any) {
      console.error('Error processing message:', error);

      // If headers not sent, return JSON error
      if (!res.headersSent) {
        return res.status(500).json({ error: error.message });
      }

      // Otherwise send SSE error
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
);

/**
 * GET /api/ai/conversations/:id/documents
 * Get conversation documents
 */
router.get('/:id/documents', async (req: Request, res: Response) => {
  try {
    const { supabase } = getTenantContext(req);
    const service = new AIConversationService(supabase);

    const documents = await service.getDocuments(req.params.id);

    res.json({ data: documents });
  } catch (error: any) {
    console.error('Error getting documents:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/conversations/:id/tasks
 * Get conversation tasks
 */
router.get('/:id/tasks', async (req: Request, res: Response) => {
  try {
    const { supabase } = getTenantContext(req);
    const service = new AIConversationService(supabase);

    const tasks = await service.getTasks(req.params.id);

    res.json({ data: tasks });
  } catch (error: any) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/usage
 * Get current user's usage statistics
 */
router.get('/usage/stats', async (req: Request, res: Response) => {
  try {
    const { supabase, userId } = getTenantContext(req);
    const { period } = req.query;

    const service = new AIUsageService(supabase);

    const stats = await service.getUserUsageWithLimits(userId);

    res.json(stats);
  } catch (error: any) {
    console.error('Error getting usage stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/usage/check
 * Check if user can perform an action
 */
router.get('/usage/check/:actionType', async (req: Request, res: Response) => {
  try {
    const { supabase, userId } = getTenantContext(req);
    const actionType = req.params.actionType as any;

    const service = new AIUsageService(supabase);

    const result = await service.checkUsageLimit(userId, actionType);

    res.json(result);
  } catch (error: any) {
    console.error('Error checking usage limit:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/usage/upgrade-recommendation
 * Get upgrade recommendation
 */
router.get('/usage/upgrade-recommendation', async (req: Request, res: Response) => {
  try {
    const { supabase, userId } = getTenantContext(req);

    const service = new AIUsageService(supabase);

    const recommendation = await service.shouldRecommendUpgrade(userId);

    res.json(recommendation);
  } catch (error: any) {
    console.error('Error getting upgrade recommendation:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
