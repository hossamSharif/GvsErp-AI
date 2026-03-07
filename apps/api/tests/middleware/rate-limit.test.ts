import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { rateLimiter, tenantKeyGenerator, userKeyGenerator } from '../../src/middleware/rate-limit';

/**
 * Unit tests for rate limiting middleware.
 * Tests rate limiter behavior, key generators, and header setting.
 */

// ==========================================================================
// Helpers
// ==========================================================================

function createMockReq(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    ip: '127.0.0.1',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' } as any,
    ...overrides,
  };
}

function createMockRes(): Partial<Response> {
  const headers: Record<string, string | number> = {};
  return {
    setHeader: vi.fn((name: string, value: string | number) => {
      headers[name] = value;
      return {} as Response;
    }),
    _headers: headers,
  } as any;
}

// ==========================================================================
// rateLimiter
// ==========================================================================

describe('rateLimiter', () => {
  it('allows requests within the limit', () => {
    const limiter = rateLimiter({ windowMs: 60000, maxRequests: 5 });
    const req = createMockReq({ ip: 'test-allow-1' });
    const res = createMockRes();
    const next = vi.fn();

    limiter(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets rate limit headers on each request', () => {
    const limiter = rateLimiter({ windowMs: 60000, maxRequests: 10 });
    const req = createMockReq({ ip: 'test-headers-1' });
    const res = createMockRes();
    const next = vi.fn();

    limiter(req as Request, res as Response, next as NextFunction);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
  });

  it('decrements remaining count on each request', () => {
    const limiter = rateLimiter({ windowMs: 60000, maxRequests: 5 });
    const req = createMockReq({ ip: 'test-decrement-1' });
    const next = vi.fn();

    // First request
    const res1 = createMockRes();
    limiter(req as Request, res1 as Response, next as NextFunction);
    expect(res1.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);

    // Second request
    const res2 = createMockRes();
    limiter(req as Request, res2 as Response, next as NextFunction);
    expect(res2.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 3);
  });

  it('blocks requests exceeding the limit', () => {
    const limiter = rateLimiter({ windowMs: 60000, maxRequests: 2 });
    const req = createMockReq({ ip: 'test-block-1' });
    const next = vi.fn();

    // First two requests should pass
    limiter(req as Request, createMockRes() as Response, next as NextFunction);
    limiter(req as Request, createMockRes() as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(2);

    // Third request should be blocked
    const res3 = createMockRes();
    limiter(req as Request, res3 as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(3);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({
      message: expect.stringContaining('Rate limit exceeded'),
    }));
  });

  it('sets Retry-After header when rate limited', () => {
    const limiter = rateLimiter({ windowMs: 60000, maxRequests: 1 });
    const req = createMockReq({ ip: 'test-retry-1' });
    const next = vi.fn();

    // First request passes
    limiter(req as Request, createMockRes() as Response, next as NextFunction);

    // Second request gets rate limited
    const res2 = createMockRes();
    limiter(req as Request, res2 as Response, next as NextFunction);
    expect(res2.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
  });

  it('remaining never goes below 0', () => {
    const limiter = rateLimiter({ windowMs: 60000, maxRequests: 1 });
    const req = createMockReq({ ip: 'test-floor-1' });
    const next = vi.fn();

    // Exhaust limit
    limiter(req as Request, createMockRes() as Response, next as NextFunction);

    // Over limit - remaining should be 0, not negative
    const res = createMockRes();
    limiter(req as Request, res as Response, next as NextFunction);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
  });

  it('uses custom key generator when provided', () => {
    const customKey = vi.fn(() => 'custom-key-1');
    const limiter = rateLimiter({
      windowMs: 60000,
      maxRequests: 5,
      keyGenerator: customKey,
    });
    const req = createMockReq();
    const next = vi.fn();

    limiter(req as Request, createMockRes() as Response, next as NextFunction);

    expect(customKey).toHaveBeenCalledWith(req);
  });

  it('tracks different IPs independently', () => {
    const limiter = rateLimiter({ windowMs: 60000, maxRequests: 1 });
    const next = vi.fn();

    const req1 = createMockReq({ ip: 'test-ip-a' });
    const req2 = createMockReq({ ip: 'test-ip-b' });

    limiter(req1 as Request, createMockRes() as Response, next as NextFunction);
    limiter(req2 as Request, createMockRes() as Response, next as NextFunction);

    // Both should pass since they're different IPs
    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenNthCalledWith(1);
    expect(next).toHaveBeenNthCalledWith(2);
  });
});

// ==========================================================================
// tenantKeyGenerator
// ==========================================================================

describe('tenantKeyGenerator', () => {
  it('returns tenant-prefixed key when tenantId exists', () => {
    const req = createMockReq() as Request;
    (req as any).tenantId = 'tenant-123';
    expect(tenantKeyGenerator(req)).toBe('tenant:tenant-123');
  });

  it('falls back to IP when no tenantId', () => {
    const req = createMockReq({ ip: '192.168.1.1' }) as Request;
    expect(tenantKeyGenerator(req)).toBe('192.168.1.1');
  });
});

// ==========================================================================
// userKeyGenerator
// ==========================================================================

describe('userKeyGenerator', () => {
  it('returns user-prefixed key when user.id exists', () => {
    const req = createMockReq() as Request;
    (req as any).user = { id: 'user-456' };
    expect(userKeyGenerator(req)).toBe('user:user-456');
  });

  it('falls back to IP when no user', () => {
    const req = createMockReq({ ip: '10.0.0.1' }) as Request;
    expect(userKeyGenerator(req)).toBe('10.0.0.1');
  });

  it('falls back to IP when user has no id', () => {
    const req = createMockReq({ ip: '10.0.0.2' }) as Request;
    (req as any).user = {};
    expect(userKeyGenerator(req)).toBe('10.0.0.2');
  });
});
