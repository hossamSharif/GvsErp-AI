import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { tenantMiddleware, verifyTenantAccess } from '../../src/middleware/tenant';

/**
 * Unit tests for tenant middleware.
 * No DB or Supabase mocks needed — pure synchronous logic.
 */

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: undefined,
    tenantId: undefined,
    params: {},
    ...overrides,
  } as Request;
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

// ==========================================================================
// tenantMiddleware
// ==========================================================================

describe('tenantMiddleware', () => {
  it('returns 401 when no user is attached to request', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    tenantMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user has no tenant_id', () => {
    const req = mockReq({
      user: { id: 'u1', email: 'a@b.com', tenant_id: '', role: 'user', permissions: [] },
    });
    const res = mockRes();
    const next = vi.fn();

    tenantMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('sets tenantId and calls next when user has tenant_id', () => {
    const req = mockReq({
      user: { id: 'u1', email: 'a@b.com', tenant_id: 't1', role: 'user', permissions: [] },
    });
    const res = mockRes();
    const next = vi.fn();

    tenantMiddleware(req, res, next);

    expect(req.tenantId).toBe('t1');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// verifyTenantAccess
// ==========================================================================

describe('verifyTenantAccess', () => {
  it('returns 401 when no user is attached', () => {
    const middleware = verifyTenantAccess();
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when no tenantId on request', () => {
    const middleware = verifyTenantAccess();
    const req = mockReq({
      user: { id: 'u1', email: 'a@b.com', tenant_id: 't1', role: 'user', permissions: [] },
      tenantId: undefined,
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when requested tenant differs from user tenant', () => {
    const middleware = verifyTenantAccess();
    const req = mockReq({
      user: { id: 'u1', email: 'a@b.com', tenant_id: 't1', role: 'user', permissions: [] },
      tenantId: 't1',
      params: { tenantId: 't2' },
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Access denied to this tenant' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows access when requested tenant matches user tenant', () => {
    const middleware = verifyTenantAccess();
    const req = mockReq({
      user: { id: 'u1', email: 'a@b.com', tenant_id: 't1', role: 'user', permissions: [] },
      tenantId: 't1',
      params: { tenantId: 't1' },
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows access when no tenant param is specified', () => {
    const middleware = verifyTenantAccess();
    const req = mockReq({
      user: { id: 'u1', email: 'a@b.com', tenant_id: 't1', role: 'user', permissions: [] },
      tenantId: 't1',
      params: {},
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('uses custom param name', () => {
    const middleware = verifyTenantAccess('orgId');
    const req = mockReq({
      user: { id: 'u1', email: 'a@b.com', tenant_id: 't1', role: 'user', permissions: [] },
      tenantId: 't1',
      params: { orgId: 't2' },
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
