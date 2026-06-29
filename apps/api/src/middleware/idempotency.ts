/**
 * Idempotency Middleware
 *
 * Makes write replays from the offline sync engine safe. When a request carries
 * an `Idempotency-Key` header, a previously-stored response for that
 * (tenant, key) is replayed verbatim instead of re-running the handler — so a
 * retried invoice create / finalize / payment never double-applies.
 *
 * No-op for GETs or requests without the header. Apply AFTER requireAuth so the
 * tenant context is available.
 */

import { Request, Response, NextFunction } from 'express';
import { getTenantContext } from './tenant';

const HEADER = 'idempotency-key';

export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const key = req.header(HEADER);
  if (!key || req.method === 'GET' || req.method === 'HEAD') {
    next();
    return;
  }

  let ctx;
  try {
    ctx = getTenantContext(req);
  } catch {
    // No tenant context yet — let the normal pipeline handle auth errors.
    next();
    return;
  }
  const { tenantId } = ctx;
  // `idempotency_keys` is intentionally not in the generated DB types yet
  // (added in migration 031); access it through an untyped handle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any;

  try {
    const { data: existing } = await sb
      .from('idempotency_keys')
      .select('status_code, response_json')
      .eq('tenant_id', tenantId)
      .eq('key', key)
      .maybeSingle();

    if (existing) {
      res.status(existing.status_code).json(existing.response_json);
      return;
    }
  } catch (err) {
    // If the lookup fails, fall through and process normally rather than block.
    console.warn('[idempotency] lookup failed', err);
  }

  // Capture the response body so we can persist it on success.
  const originalJson = res.json.bind(res);
  res.json = function patchedJson(body?: unknown) {
    const statusCode = res.statusCode || 200;
    if (statusCode >= 200 && statusCode < 300) {
      void sb
        .from('idempotency_keys')
        .upsert(
          {
            tenant_id: tenantId,
            key,
            method: req.method,
            endpoint: req.originalUrl,
            status_code: statusCode,
            response_json: body,
          },
          { onConflict: 'tenant_id,key', ignoreDuplicates: true }
        )
        .then(({ error }: { error: { message: string } | null }) => {
          if (error) console.warn('[idempotency] store failed', error.message);
        });
    }
    return originalJson(body);
  } as typeof res.json;

  next();
}
