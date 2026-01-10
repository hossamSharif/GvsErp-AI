/**
 * AI Documents Routes
 * Handles document upload and retrieval endpoints
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { AIDocumentService } from '../services/ai-document.service';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

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
  requireAuth,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { conversation_id, message_id } = req.query;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { supabase, tenantId, userId } = getTenantContext(req);

      // Get user's subscription tier
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
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const { supabase, tenantId, userId } = getTenantContext(req);

      const documentService = new AIDocumentService(supabase);

      const document = await documentService.get(documentId);

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Verify user has access to this document
      if (
        document.tenant_id !== tenantId ||
        document.user_id !== userId
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
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { conversation_id } = req.query;

      if (!conversation_id) {
        return res.status(400).json({ error: 'conversation_id is required' });
      }

      const { supabase } = getTenantContext(req);

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
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const { supabase, tenantId, userId } = getTenantContext(req);

      const documentService = new AIDocumentService(supabase);

      // Get document to verify ownership
      const document = await documentService.get(documentId);

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Verify user has access to this document
      if (
        document.tenant_id !== tenantId ||
        document.user_id !== userId
      ) {
        return res
          .status(403)
          .json({ error: 'Access denied to this document' });
      }

      await documentService.delete(tenantId, documentId);

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
