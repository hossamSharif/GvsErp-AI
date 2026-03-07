import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest, validateBody, validateQuery, validateParams } from '../../src/middleware/validate';

/**
 * Unit tests for request validation middleware.
 * No DB needed — pure middleware logic.
 */

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe('validateRequest', () => {
  it('calls next() when body passes validation', async () => {
    const schema = z.object({ name: z.string() });
    const middleware = validateRequest({ body: schema });
    const req = mockReq({ body: { name: 'Test' } });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with error when body fails validation', async () => {
    const schema = z.object({ name: z.string() });
    const middleware = validateRequest({ body: schema });
    const req = mockReq({ body: {} });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it('replaces request body with validated data', async () => {
    const schema = z.object({ name: z.string().trim() });
    const middleware = validateRequest({ body: schema });
    const req = mockReq({ body: { name: '  hello  ', extra: 'ignored' } });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(req.body).toEqual({ name: 'hello' });
  });

  it('validates query params', async () => {
    const schema = z.object({ page: z.coerce.number() });
    const middleware = validateRequest({ query: schema });
    const req = mockReq({ query: { page: '5' } as any });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ page: 5 });
  });

  it('validates route params', async () => {
    const schema = z.object({ id: z.string().uuid() });
    const middleware = validateRequest({ params: schema });
    const req = mockReq({ params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects invalid route params', async () => {
    const schema = z.object({ id: z.string().uuid() });
    const middleware = validateRequest({ params: schema });
    const req = mockReq({ params: { id: 'not-a-uuid' } });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it('validates multiple schemas simultaneously', async () => {
    const bodySchema = z.object({ name: z.string() });
    const querySchema = z.object({ page: z.coerce.number() });
    const middleware = validateRequest({ body: bodySchema, query: querySchema });
    const req = mockReq({ body: { name: 'Test' }, query: { page: '1' } as any });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Test' });
    expect(req.query).toEqual({ page: 1 });
  });

  it('fails fast on first invalid schema', async () => {
    const bodySchema = z.object({ name: z.string() });
    const querySchema = z.object({ page: z.coerce.number() });
    const middleware = validateRequest({ body: bodySchema, query: querySchema });
    const req = mockReq({ body: {}, query: { page: 'abc' } as any });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it('skips validation when no schemas provided', async () => {
    const middleware = validateRequest({});
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('validateBody', () => {
  it('validates only body', async () => {
    const schema = z.object({ email: z.string().email() });
    const middleware = validateBody(schema);
    const req = mockReq({ body: { email: 'test@example.com' } });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects invalid body', async () => {
    const schema = z.object({ email: z.string().email() });
    const middleware = validateBody(schema);
    const req = mockReq({ body: { email: 'not-an-email' } });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
  });
});

describe('validateQuery', () => {
  it('validates only query', async () => {
    const schema = z.object({ search: z.string().optional() });
    const middleware = validateQuery(schema);
    const req = mockReq({ query: { search: 'hello' } as any });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('validateParams', () => {
  it('validates only params', async () => {
    const schema = z.object({ id: z.string() });
    const middleware = validateParams(schema);
    const req = mockReq({ params: { id: 'abc123' } });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
