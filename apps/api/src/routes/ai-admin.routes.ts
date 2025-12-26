/**
 * AI Admin Routes
 * Provides admin endpoints for AI usage monitoring and configuration
 */

import { Router, type Request, type Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { AIAdminService } from '../services/ai-admin.service';

/**
 * Admin permission check middleware
 * Ensures user has admin/system:admin permissions
 */
function requireAdmin(req: Request, res: Response, next: Function) {
  const permissions = (req as any).permissions || [];

  if (!permissions.includes('system:admin') && !permissions.includes('admin')) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin permissions required',
    });
  }

  next();
}

/**
 * Create AI admin routes
 * @param supabase - Supabase client
 * @returns Express router
 */
export function createAIAdminRoutes(
  supabase: SupabaseClient<Database>
): Router {
  const router = Router();
  const adminService = new AIAdminService(supabase);

  // Apply admin permission check to all routes
  router.use(requireAdmin);

  /**
   * GET /api/ai/admin/usage
   * Get aggregate usage statistics
   * Query params: startDate, endDate
   */
  router.get('/usage', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'startDate and endDate query parameters are required',
        });
      }

      const stats = await adminService.getAggregateUsage(
        startDate as string,
        endDate as string
      );

      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching aggregate usage:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/ai/admin/tenants/:id/usage
   * Get usage statistics for a specific tenant
   * Query params: startDate, endDate
   */
  router.get('/tenants/:id/usage', async (req: Request, res: Response) => {
    try {
      const { id: tenantId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'startDate and endDate query parameters are required',
        });
      }

      const stats = await adminService.getTenantUsage(
        tenantId,
        startDate as string,
        endDate as string
      );

      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching tenant usage:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/ai/admin/tenants/:id/disable
   * Disable AI feature for a specific tenant
   */
  router.post('/tenants/:id/disable', async (req: Request, res: Response) => {
    try {
      const { id: tenantId } = req.params;

      await adminService.disableTenantAI(tenantId);

      res.json({
        success: true,
        message: `AI disabled for tenant ${tenantId}`,
      });
    } catch (error: any) {
      console.error('Error disabling tenant AI:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/ai/admin/tenants/:id/enable
   * Enable AI feature for a specific tenant
   */
  router.post('/tenants/:id/enable', async (req: Request, res: Response) => {
    try {
      const { id: tenantId } = req.params;

      await adminService.enableTenantAI(tenantId);

      res.json({
        success: true,
        message: `AI enabled for tenant ${tenantId}`,
      });
    } catch (error: any) {
      console.error('Error enabling tenant AI:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/ai/admin/configurations
   * Get all AI configurations
   * Query params: tenantId (optional)
   */
  router.get('/configurations', async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.query;

      const configs = await adminService.getConfigurations(
        tenantId as string | undefined
      );

      res.json(configs);
    } catch (error: any) {
      console.error('Error fetching configurations:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/ai/admin/configurations
   * Create or update a configuration
   * Body: { tenantId, configKey, configValue, description }
   */
  router.post('/configurations', async (req: Request, res: Response) => {
    try {
      const { tenantId, configKey, configValue, description } = req.body;

      if (!configKey || configValue === undefined) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'configKey and configValue are required',
        });
      }

      const config = await adminService.upsertConfiguration(
        tenantId || null,
        configKey,
        configValue,
        description
      );

      res.json(config);
    } catch (error: any) {
      console.error('Error upserting configuration:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  /**
   * DELETE /api/ai/admin/configurations
   * Delete a configuration
   * Query params: tenantId (optional), configKey (required)
   */
  router.delete('/configurations', async (req: Request, res: Response) => {
    try {
      const { tenantId, configKey } = req.query;

      if (!configKey) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'configKey query parameter is required',
        });
      }

      await adminService.deleteConfiguration(
        (tenantId as string) || null,
        configKey as string
      );

      res.json({
        success: true,
        message: 'Configuration deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting configuration:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  return router;
}
