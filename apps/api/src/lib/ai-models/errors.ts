/**
 * AI Error handling classes
 * Provides error codes and retry logic for AI operations
 */

/**
 * AI Error codes
 */
export enum AIErrorCode {
  // Model/Provider errors
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  MODEL_OVERLOADED = 'MODEL_OVERLOADED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Request errors
  INVALID_REQUEST = 'INVALID_REQUEST',
  CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED',
  CONTENT_FILTER = 'CONTENT_FILTER',

  // Usage/Tier errors
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  TIER_LIMIT_EXCEEDED = 'TIER_LIMIT_EXCEEDED',

  // Permission errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Data errors
  DATA_ACCESS_ERROR = 'DATA_ACCESS_ERROR',

  // Processing errors
  DOCUMENT_PROCESSING_FAILED = 'DOCUMENT_PROCESSING_FAILED',
  TASK_GENERATION_FAILED = 'TASK_GENERATION_FAILED',

  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  TIMEOUT = 'TIMEOUT',
}

/**
 * Retry configuration for different error types
 */
interface RetryConfig {
  maxAttempts: number;
  shouldRetry: boolean;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
}

/**
 * Default retry configurations by error code
 */
const RETRY_CONFIGS: Record<AIErrorCode, RetryConfig> = {
  // Retryable errors with exponential backoff
  [AIErrorCode.MODEL_UNAVAILABLE]: {
    maxAttempts: 3,
    shouldRetry: true,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  },
  [AIErrorCode.MODEL_OVERLOADED]: {
    maxAttempts: 3,
    shouldRetry: true,
    baseDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 3,
  },
  [AIErrorCode.RATE_LIMIT_EXCEEDED]: {
    maxAttempts: 3,
    shouldRetry: true,
    baseDelay: 5000,
    maxDelay: 120000,
    backoffMultiplier: 4,
  },
  [AIErrorCode.TIMEOUT]: {
    maxAttempts: 2,
    shouldRetry: true,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },

  // Non-retryable errors
  [AIErrorCode.INVALID_API_KEY]: {
    maxAttempts: 1,
    shouldRetry: false,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
  },
  [AIErrorCode.INVALID_REQUEST]: {
    maxAttempts: 1,
    shouldRetry: false,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
  },
  [AIErrorCode.CONTEXT_LENGTH_EXCEEDED]: {
    maxAttempts: 1,
    shouldRetry: false,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
  },
  [AIErrorCode.CONTENT_FILTER]: {
    maxAttempts: 1,
    shouldRetry: false,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
  },
  [AIErrorCode.USAGE_LIMIT_EXCEEDED]: {
    maxAttempts: 1,
    shouldRetry: false,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
  },
  [AIErrorCode.TIER_LIMIT_EXCEEDED]: {
    maxAttempts: 1,
    shouldRetry: false,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
  },
  [AIErrorCode.PERMISSION_DENIED]: {
    maxAttempts: 1,
    shouldRetry: false,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
  },
  [AIErrorCode.DATA_ACCESS_ERROR]: {
    maxAttempts: 2,
    shouldRetry: true,
    baseDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
  },
  [AIErrorCode.DOCUMENT_PROCESSING_FAILED]: {
    maxAttempts: 2,
    shouldRetry: true,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  [AIErrorCode.TASK_GENERATION_FAILED]: {
    maxAttempts: 2,
    shouldRetry: true,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  [AIErrorCode.UNKNOWN_ERROR]: {
    maxAttempts: 2,
    shouldRetry: true,
    baseDelay: 1000,
    maxDelay: 15000,
    backoffMultiplier: 2,
  },
};

/**
 * Custom error class for AI operations
 */
export class AIError extends Error {
  public readonly code: AIErrorCode;
  public readonly statusCode: number;
  public readonly retryConfig: RetryConfig;
  public readonly isRetryable: boolean;
  public readonly metadata?: Record<string, any>;

  constructor(
    code: AIErrorCode,
    message: string,
    statusCode: number = 500,
    metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryConfig = RETRY_CONFIGS[code];
    this.isRetryable = this.retryConfig.shouldRetry;
    this.metadata = metadata;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Calculate delay for next retry attempt using exponential backoff
   * @param attemptNumber - Current attempt number (1-indexed)
   * @returns Delay in milliseconds
   */
  calculateRetryDelay(attemptNumber: number): number {
    if (!this.isRetryable || attemptNumber > this.retryConfig.maxAttempts) {
      return 0;
    }

    const { baseDelay, maxDelay, backoffMultiplier } = this.retryConfig;

    // Exponential backoff: baseDelay * (backoffMultiplier ^ (attempt - 1))
    const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attemptNumber - 1);

    // Add jitter (random 0-20%) to prevent thundering herd
    const jitter = exponentialDelay * (Math.random() * 0.2);
    const delayWithJitter = exponentialDelay + jitter;

    // Cap at maxDelay
    return Math.min(delayWithJitter, maxDelay);
  }

  /**
   * Check if retry should be attempted
   * @param attemptNumber - Current attempt number (1-indexed)
   * @returns True if should retry
   */
  shouldRetry(attemptNumber: number): boolean {
    return this.isRetryable && attemptNumber < this.retryConfig.maxAttempts;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    const messages: Record<AIErrorCode, string> = {
      [AIErrorCode.MODEL_UNAVAILABLE]:
        'The AI service is temporarily unavailable. Please try again in a moment.',
      [AIErrorCode.MODEL_OVERLOADED]:
        'The AI service is experiencing high demand. Please try again shortly.',
      [AIErrorCode.INVALID_API_KEY]:
        'AI service configuration error. Please contact support.',
      [AIErrorCode.RATE_LIMIT_EXCEEDED]:
        'You\'ve sent too many requests. Please wait a moment before trying again.',
      [AIErrorCode.INVALID_REQUEST]:
        'Invalid request. Please rephrase your question and try again.',
      [AIErrorCode.CONTEXT_LENGTH_EXCEEDED]:
        'Your conversation is too long. Please start a new conversation.',
      [AIErrorCode.CONTENT_FILTER]:
        'Your message was flagged by content filters. Please rephrase.',
      [AIErrorCode.USAGE_LIMIT_EXCEEDED]:
        'You\'ve reached your usage limit for today. Upgrade to premium for unlimited access.',
      [AIErrorCode.TIER_LIMIT_EXCEEDED]:
        'You\'ve reached your plan limit. Upgrade to continue using this feature.',
      [AIErrorCode.PERMISSION_DENIED]:
        'You don\'t have permission to access this data.',
      [AIErrorCode.DATA_ACCESS_ERROR]:
        'Unable to access the requested data. Please try again.',
      [AIErrorCode.DOCUMENT_PROCESSING_FAILED]:
        'Failed to process your document. Please try uploading again.',
      [AIErrorCode.TASK_GENERATION_FAILED]:
        'Failed to generate task. Please rephrase your request.',
      [AIErrorCode.UNKNOWN_ERROR]:
        'An unexpected error occurred. Please try again.',
      [AIErrorCode.TIMEOUT]:
        'Request timed out. Please try again.',
    };

    return messages[this.code] || this.message;
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.getUserMessage(),
        statusCode: this.statusCode,
        isRetryable: this.isRetryable,
        metadata: this.metadata,
      },
    };
  }
}

/**
 * Factory functions for common AI errors
 */
export class AIErrorFactory {
  static modelUnavailable(details?: string): AIError {
    return new AIError(
      AIErrorCode.MODEL_UNAVAILABLE,
      details || 'AI model is currently unavailable',
      503
    );
  }

  static modelOverloaded(details?: string): AIError {
    return new AIError(
      AIErrorCode.MODEL_OVERLOADED,
      details || 'AI model is overloaded',
      503
    );
  }

  static rateLimitExceeded(retryAfter?: number): AIError {
    return new AIError(
      AIErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      429,
      { retryAfter }
    );
  }

  static usageLimitExceeded(tier: string, limit: number, used: number): AIError {
    return new AIError(
      AIErrorCode.USAGE_LIMIT_EXCEEDED,
      `Usage limit exceeded for ${tier} tier: ${used}/${limit}`,
      429,
      { tier, limit, used }
    );
  }

  static permissionDenied(requiredPermission: string): AIError {
    return new AIError(
      AIErrorCode.PERMISSION_DENIED,
      `Permission denied: ${requiredPermission} required`,
      403,
      { requiredPermission }
    );
  }

  static contextLengthExceeded(maxLength: number, actualLength: number): AIError {
    return new AIError(
      AIErrorCode.CONTEXT_LENGTH_EXCEEDED,
      `Context length exceeded: ${actualLength} > ${maxLength}`,
      400,
      { maxLength, actualLength }
    );
  }

  static invalidRequest(reason: string): AIError {
    return new AIError(
      AIErrorCode.INVALID_REQUEST,
      `Invalid request: ${reason}`,
      400
    );
  }

  static timeout(operationName: string): AIError {
    return new AIError(
      AIErrorCode.TIMEOUT,
      `Operation timed out: ${operationName}`,
      504
    );
  }
}
