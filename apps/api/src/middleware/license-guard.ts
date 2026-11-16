/**
 * Local edition: make the API read-only when there is no usable license
 * (trial over, key expired, wrong PC, clock tampering). Reads always work, so
 * clients never lose access to their data. Mounted only when DEPLOYMENT_MODE=local.
 */

import type { Request, Response, NextFunction } from 'express';
import { getLicenseStatus } from '../services/license.service';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Sign-in/out and entering a new license key must always work.
const ALWAYS_ALLOWED = [/^\/auth(\/|$)/, /^\/license(\/|$)/];

export async function licenseGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!WRITE_METHODS.has(req.method) || ALWAYS_ALLOWED.some((re) => re.test(req.path))) {
    next();
    return;
  }
  try {
    const status = await getLicenseStatus();
    if (status.canWrite) {
      next();
      return;
    }
    res.status(403).json({
      code: 'LICENSE_READ_ONLY',
      message:
        status.state === 'trial_expired'
          ? 'Your free trial has ended. Enter a license key to keep adding and editing data.'
          : 'Your license does not allow changes right now. Enter a valid license key.',
      meta: { state: status.state },
    });
  } catch (err) {
    next(err);
  }
}
