/**
 * Error Handling Middleware
 *
 * Centralized error handling for the API.
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import type { ApiError, ErrorCode } from '@erp/shared';

/**
 * Custom API Error class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Array<{ field: string; message: string }>;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: Array<{ field: string; message: string }>) {
    return new AppError('VALIDATION_ERROR', message, 400, details);
  }

  static unauthorized(message: string = 'Authentication required') {
    return new AppError('UNAUTHORIZED', message, 401);
  }

  static forbidden(message: string = 'Access denied') {
    return new AppError('FORBIDDEN', message, 403);
  }

  static notFound(message: string = 'Resource not found') {
    return new AppError('NOT_FOUND', message, 404);
  }

  static conflict(message: string) {
    return new AppError('CONFLICT', message, 409);
  }

  static limitExceeded(message: string) {
    return new AppError('LIMIT_EXCEEDED', message, 402);
  }

  static rateLimited(message: string = 'Too many requests') {
    return new AppError('RATE_LIMITED', message, 429);
  }

  static internal(message: string = 'Internal server error') {
    return new AppError('INTERNAL_ERROR', message, 500);
  }
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    request_id: req.headers['x-request-id'] as string,
  } as ApiError);
}

/**
 * Type guard for domain service errors (ItemError, CategoryError, etc.)
 * All domain errors share { code: string, statusCode: number } on an Error instance.
 */
function isServiceError(err: unknown): err is Error & { code: string; statusCode: number } {
  if (!(err instanceof Error)) return false;
  const obj = err as unknown as Record<string, unknown>;
  return typeof obj.code === 'string' && typeof obj.statusCode === 'number';
}

/**
 * Global error handler
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  // Log error
  console.error(`[${requestId}] Error:`, {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user?.id,
    tenant: req.tenantId,
  });

  // Handle AppError (operational errors)
  if (err instanceof AppError && err.isOperational) {
    const response: ApiError = {
      code: err.code,
      message: err.message,
      request_id: requestId,
    };

    if (err.details) {
      response.details = err.details;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle domain service errors (ItemError, CategoryError, PaymentError, etc.)
  if (isServiceError(err)) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      request_id: requestId,
    } as ApiError);
    return;
  }

  // Handle unexpected errors
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
    request_id: requestId,
  } as ApiError);
}

/**
 * Async handler wrapper to catch promise rejections
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
