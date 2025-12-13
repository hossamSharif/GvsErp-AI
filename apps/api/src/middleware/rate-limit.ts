/**
 * Rate Limiting Middleware
 *
 * Implements rate limiting per IP and per tenant.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from './error';

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyGenerator?: (req: Request) => string;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (use Redis in production)
const stores: Map<string, RateLimitStore> = new Map();

/**
 * Create rate limiter middleware
 */
export function rateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
  } = config;

  const storeName = `ratelimit_${windowMs}_${maxRequests}`;
  
  if (!stores.has(storeName)) {
    stores.set(storeName, {});
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const store = stores.get(storeName)!;
    const key = keyGenerator(req);
    const now = Date.now();

    // Get or create entry
    let entry = store[key];
    
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      store[key] = entry;
    }

    entry.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);

      next(AppError.rateLimited(
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`
      ));
      return;
    }

    next();
  };
}

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  return (
    req.ip ||
    req.headers['x-forwarded-for']?.toString() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Tenant-based key generator
 */
export function tenantKeyGenerator(req: Request): string {
  if (req.tenantId) {
    return `tenant:${req.tenantId}`;
  }
  return defaultKeyGenerator(req);
}

/**
 * User-based key generator
 */
export function userKeyGenerator(req: Request): string {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  return defaultKeyGenerator(req);
}

// Preset rate limiters
export const apiRateLimiter = rateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 100,     // 100 requests per minute
});

export const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,           // 10 attempts per 15 minutes
});

export const heavyOpRateLimiter = rateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 10,      // 10 requests per minute
  keyGenerator: tenantKeyGenerator,
});

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  stores.forEach((store) => {
    Object.keys(store).forEach((key) => {
      if (now > store[key].resetTime) {
        delete store[key];
      }
    });
  });
}, 60 * 1000); // Clean up every minute
