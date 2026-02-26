import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError, errorHandler, notFoundHandler, asyncHandler } from '../../src/middleware/error';
import type { Request, Response, NextFunction } from 'express';

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/test',
    headers: { 'x-request-id': 'test-req-id' },
    user: undefined,
    tenantId: undefined,
    ...overrides,
  } as unknown as Request;
}

function mockResponse(): Response & { _status: number; _json: unknown } {
  const res = {
    _status: 0,
    _json: null as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._json = body;
      return res;
    },
  };
  return res as unknown as Response & { _status: number; _json: unknown };
}

describe('AppError', () => {
  it('creates error with default status 500', () => {
    const err = new AppError('INTERNAL_ERROR', 'something broke');
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.message).toBe('something broke');
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('creates error with custom status and details', () => {
    const details = [{ field: 'email', message: 'required' }];
    const err = new AppError('VALIDATION_ERROR', 'invalid', 400, details);
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual(details);
  });

  it.each([
    ['badRequest', 400, 'VALIDATION_ERROR'],
    ['unauthorized', 401, 'UNAUTHORIZED'],
    ['forbidden', 403, 'FORBIDDEN'],
    ['notFound', 404, 'NOT_FOUND'],
    ['conflict', 409, 'CONFLICT'],
    ['limitExceeded', 402, 'LIMIT_EXCEEDED'],
    ['rateLimited', 429, 'RATE_LIMITED'],
    ['internal', 500, 'INTERNAL_ERROR'],
  ] as const)('%s() returns status %i with code %s', (method, status, code) => {
    const err = AppError[method]('test message');
    expect(err.statusCode).toBe(status);
    expect(err.code).toBe(code);
    expect(err.message).toBe('test message');
  });

  it('badRequest() accepts details', () => {
    const details = [{ field: 'name', message: 'too short' }];
    const err = AppError.badRequest('bad input', details);
    expect(err.details).toEqual(details);
  });

  it('unauthorized() uses default message', () => {
    const err = AppError.unauthorized();
    expect(err.message).toBe('Authentication required');
  });

  it('forbidden() uses default message', () => {
    const err = AppError.forbidden();
    expect(err.message).toBe('Access denied');
  });
});

describe('notFoundHandler', () => {
  it('responds with 404 and route info', () => {
    const req = mockRequest({ method: 'POST', path: '/api/v1/missing' });
    const res = mockResponse();
    const next = vi.fn();

    notFoundHandler(req, res, next);

    expect(res._status).toBe(404);
    expect(res._json).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Route POST /api/v1/missing not found',
      request_id: 'test-req-id',
    });
  });
});

describe('errorHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('handles AppError with correct status and body', () => {
    const err = AppError.badRequest('name required', [{ field: 'name', message: 'required' }]);
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res._status).toBe(400);
    expect(res._json).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'name required',
      request_id: 'test-req-id',
      details: [{ field: 'name', message: 'required' }],
    });
  });

  it('handles generic Error with 500', () => {
    const err = new Error('unexpected');
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res._status).toBe(500);
    expect(res._json).toMatchObject({
      code: 'INTERNAL_ERROR',
      request_id: 'test-req-id',
    });
  });

  it('hides error message in production', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('secret details');
    const req = mockRequest();
    const res = mockResponse();

    errorHandler(err, req, res, vi.fn());

    expect((res._json as { message: string }).message).toBe('An unexpected error occurred');
    process.env.NODE_ENV = original;
  });

  it('generates request ID when missing', () => {
    const err = new Error('fail');
    const req = mockRequest({ headers: {} });
    const res = mockResponse();

    errorHandler(err, req, res, vi.fn());

    const json = res._json as { request_id: string };
    expect(json.request_id).toBeDefined();
    expect(json.request_id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('asyncHandler', () => {
  it('calls the wrapped function', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const handler = asyncHandler(fn);
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    handler(req, res as unknown as Response, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(fn).toHaveBeenCalledWith(req, res, next);
  });

  it('passes rejection to next', async () => {
    const error = new Error('async fail');
    const fn = vi.fn().mockRejectedValue(error);
    const handler = asyncHandler(fn);
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    handler(req, res as unknown as Response, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(next).toHaveBeenCalledWith(error);
  });
});
