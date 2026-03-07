import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requirePermission } from '../../src/middleware/auth';

/**
 * Unit tests for requirePermission middleware.
 * No DB or Supabase mocks needed — pure synchronous logic.
 */

function mockReq(user?: Request['user']): Request {
  return { user } as Request;
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('requirePermission', () => {
  it('returns 401 when no user is attached to request', () => {
    const middleware = requirePermission('items:read' as any);
    const req = mockReq(undefined);
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows access with wildcard permission', () => {
    const middleware = requirePermission('items:write' as any);
    const req = mockReq({
      id: 'u1',
      email: 'test@example.com',
      tenant_id: 't1',
      role: 'admin',
      permissions: ['*' as any],
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows access when user has the required permission', () => {
    const middleware = requirePermission('items:read' as any);
    const req = mockReq({
      id: 'u1',
      email: 'test@example.com',
      tenant_id: 't1',
      role: 'user',
      permissions: ['items:read' as any, 'items:write' as any],
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when user lacks the required permission', () => {
    const middleware = requirePermission('invoices:delete' as any);
    const req = mockReq({
      id: 'u1',
      email: 'test@example.com',
      tenant_id: 't1',
      role: 'user',
      permissions: ['items:read' as any],
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows access when user has any one of multiple required permissions', () => {
    const middleware = requirePermission('items:write' as any, 'items:delete' as any);
    const req = mockReq({
      id: 'u1',
      email: 'test@example.com',
      tenant_id: 't1',
      role: 'user',
      permissions: ['items:delete' as any],
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when user has none of the required permissions', () => {
    const middleware = requirePermission('invoices:write' as any, 'invoices:delete' as any);
    const req = mockReq({
      id: 'u1',
      email: 'test@example.com',
      tenant_id: 't1',
      role: 'user',
      permissions: ['items:read' as any],
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('includes required permissions in the error message', () => {
    const middleware = requirePermission('invoices:write' as any, 'invoices:delete' as any);
    const req = mockReq({
      id: 'u1',
      email: 'test@example.com',
      tenant_id: 't1',
      role: 'user',
      permissions: [],
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('invoices:write'),
      })
    );
  });

  it('allows access with empty permissions array when user has wildcard', () => {
    const middleware = requirePermission();
    const req = mockReq({
      id: 'u1',
      email: 'test@example.com',
      tenant_id: 't1',
      role: 'admin',
      permissions: ['*' as any],
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 with empty user permissions array', () => {
    const middleware = requirePermission('items:read' as any);
    const req = mockReq({
      id: 'u1',
      email: 'test@example.com',
      tenant_id: 't1',
      role: 'user',
      permissions: [],
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
