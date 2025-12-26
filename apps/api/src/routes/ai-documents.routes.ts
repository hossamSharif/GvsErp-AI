/**
 * AI Documents Routes
 * Handles document upload and retrieval endpoints
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import { AIDocumentService } from '../services/ai-document.service';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
        )
      );
    }
  },
});

/**
 * POST /api/ai/documents
 * Upload a document for processing
 */
router.post(
  '/documents',
  authenticateToken,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { conversation_id, message_id } = req.query;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const user = (req as any).user;
      const tenantId = user.tenant_id;
      const userId = user.user_id;

      // Get user's subscription tier
      const supabase = createClient<Database>(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        return res.status(500).json({ error: 'Failed to fetch user data' });
      }

      const subscriptionTier =
        (userData.subscription_tier as 'free' | 'premium') || 'free';

      // Create document service
      const documentService = new AIDocumentService(supabase);

      // Upload document
      const document = await documentService.upload({
        conversationId: conversation_id as string | undefined,
        messageId: message_id as string | undefined,
        tenantId,
        userId,
        file: file.buffer,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        subscriptionTier,
      });

      return res.status(201).json(document);
    } catch (error) {
      console.error('Document upload error:', error);

      if (
        error instanceof Error &&
        error.message.includes('Monthly document limit reached')
      ) {
        return res.status(403).json({
          error: error.message,
          code: 'DOCUMENT_LIMIT_EXCEEDED',
        });
      }

      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to upload document',
      });
    }
  }
);

/**
 * GET /api/ai/documents/:documentId
 * Get document details and processing status
 */
router.get(
  '/documents/:documentId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const user = (req as any).user;

      const supabase = createClient<Database>(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const documentService = new AIDocumentService(supabase);

      const document = await documentService.get(documentId);

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Verify user has access to this document
      if (
        document.tenant_id !== user.tenant_id ||
        document.user_id !== user.user_id
      ) {
        return res
          .status(403)
          .json({ error: 'Access denied to this document' });
      }

      return res.json(document);
    } catch (error) {
      console.error('Get document error:', error);
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to get document',
      });
    }
  }
);

/**
 * GET /api/ai/documents
 * Get documents by conversation
 */
router.get(
  '/documents',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { conversation_id } = req.query;

      if (!conversation_id) {
        return res.status(400).json({ error: 'conversation_id is required' });
      }

      const supabase = createClient<Database>(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const documentService = new AIDocumentService(supabase);

      const documents = await documentService.getDocumentsByConversation(
        conversation_id as string
      );

      return res.json(documents);
    } catch (error) {
      console.error('Get documents error:', error);
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to get documents',
      });
    }
  }
);

/**
 * DELETE /api/ai/documents/:documentId
 * Delete a document
 */
router.delete(
  '/documents/:documentId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const user = (req as any).user;

      const supabase = createClient<Database>(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const documentService = new AIDocumentService(supabase);

      // Get document to verify ownership
      const document = await documentService.get(documentId);

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Verify user has access to this document
      if (
        document.tenant_id !== user.tenant_id ||
        document.user_id !== user.user_id
      ) {
        return res
          .status(403)
          .json({ error: 'Access denied to this document' });
      }

      await documentService.delete(user.tenant_id, documentId);

      return res.status(204).send();
    } catch (error) {
      console.error('Delete document error:', error);
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to delete document',
      });
    }
  }
);

export default router;
