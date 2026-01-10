/**
 * Data Health Monitoring Routes
 *
 * Provides endpoints for checking database health and detecting empty data scenarios
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { DataHealthService } from '../services/data-health.service';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * GET /api/v1/data-health
 * Get comprehensive health status for current tenant
 */
router.get('/', async (req, res) => {
  try {
    const { supabase, tenantId } = getTenantContext(req);

    const healthService = new DataHealthService(supabase);
    const health = await healthService.checkTenantHealth(tenantId);

    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('Error checking data health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check data health',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/data-health/quick
 * Quick health check for current tenant
 */
router.get('/quick', async (req, res) => {
  try {
    const { supabase, tenantId } = getTenantContext(req);

    const healthService = new DataHealthService(supabase);
    const health = await healthService.quickHealthCheck(tenantId);

    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('Error in quick health check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform quick health check',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/data-health/is-fresh
 * Check if tenant is fresh (no data)
 */
router.get('/is-fresh', async (req, res) => {
  try {
    const { supabase, tenantId } = getTenantContext(req);

    const healthService = new DataHealthService(supabase);
    const isFresh = await healthService.isFreshTenant(tenantId);

    res.json({
      success: true,
      data: {
        isFresh,
        message: isFresh
          ? 'This is a fresh tenant with no data. Consider running the seed script.'
          : 'Tenant has existing data.',
      },
    });
  } catch (error) {
    console.error('Error checking if tenant is fresh:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check tenant freshness',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/data-health/scan-all
 * Scan all tenants for health issues (admin only)
 * Note: This should be protected with admin-only middleware in production
 */
router.get('/scan-all', async (req, res) => {
  try {
    // TODO: Add admin-only check here
    // if (!req.user?.is_admin) {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    const { supabase } = getTenantContext(req);
    const healthService = new DataHealthService(supabase);
    const scan = await healthService.scanAllTenants();

    res.json({
      success: true,
      data: scan,
    });
  } catch (error) {
    console.error('Error scanning all tenants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan tenants',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
