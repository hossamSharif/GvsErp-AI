/**
 * Request Validation Middleware
 *
 * Validates request body, query, and params using Zod schemas.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './error';

type ValidationType = 'body' | 'query' | 'params';

interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validate request data against Zod schemas
 */
export function validateRequest(schemas: ValidationOptions) {
  return validate(schemas);
}

export function validate(schemas: ValidationOptions) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const validationTypes: ValidationType[] = ['body', 'query', 'params'];

      for (const type of validationTypes) {
        const schema = schemas[type];
        if (schema) {
          const result = await schema.safeParseAsync(req[type]);

          if (!result.success) {
            const errors = formatZodErrors(result.error);
            throw AppError.badRequest('Validation failed', errors);
          }

          // Replace request data with validated/transformed data
          (req as Record<string, unknown>)[type] = result.data;
        }
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }

      if (error instanceof ZodError) {
        const errors = formatZodErrors(error);
        next(AppError.badRequest('Validation failed', errors));
        return;
      }

      next(error);
    }
  };
}

/**
 * Validate request body only (convenience wrapper)
 */
export function validateBody(schema: ZodSchema) {
  return validate({ body: schema });
}

/**
 * Validate query params only (convenience wrapper)
 */
export function validateQuery(schema: ZodSchema) {
  return validate({ query: schema });
}

/**
 * Validate route params only (convenience wrapper)
 */
export function validateParams(schema: ZodSchema) {
  return validate({ params: schema });
}

/**
 * Format Zod errors into API error format
 */
function formatZodErrors(
  error: ZodError
): Array<{ field: string; message: string; code?: string }> {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}
