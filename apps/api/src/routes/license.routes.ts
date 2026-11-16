/**
 * Local edition license endpoints (mounted only when DEPLOYMENT_MODE=local).
 *
 * GET  /license/status  any signed-in user: state, days left, users, PC ID
 * POST /license         admin: install a new license key
 */

import { Router, type IRouter, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { getLicenseStatus, installLicenseKey } from '../services/license.service';

const router: IRouter = Router();

router.use(requireAuth);

router.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: await getLicenseStatus() });
  })
);

router.post(
  '/',
  requirePermission('settings:write'),
  validateRequest({ body: z.object({ key: z.string().min(10).max(4000) }) }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await installLicenseKey(req.body.key) });
  })
);

export default router;
