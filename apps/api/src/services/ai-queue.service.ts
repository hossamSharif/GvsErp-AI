/**
 * AI Queue Service
 * Manages retry queue for failed AI requests
 * Implements exponential backoff retry logic (3 attempts over 5 minutes)
 */

import { AIError, AIErrorCode } from '../lib/ai-models/errors';

/**
 * Queued request interface
 */
interface QueuedRequest<T> {
  id: string;
  operation: () => Promise<T>;
  attemptNumber: number;
  maxAttempts: number;
  lastError?: AIError;
  nextRetryAt?: Date;
  createdAt: Date;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

/**
 * Retry queue status
 */
export interface RetryQueueStatus {
  pendingRequests: number;
  failedRequests: number;
  successfulRetries: number;
  totalProcessed: number;
}

/**
 * AI Queue Service
 * Handles retry logic with exponential backoff for failed AI requests
 */
export class AIQueueService {
  private queue: Map<string, QueuedRequest<any>> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private stats = {
    failed: 0,
    successfulRetries: 0,
    totalProcessed: 0,
  };

  /**
   * Execute operation with automatic retry on failure
   * @param operation - Async operation to execute
   * @param operationId - Unique identifier for this operation
   * @returns Promise that resolves when operation succeeds or all retries exhausted
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationId: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: operationId,
        operation,
        attemptNumber: 1,
        maxAttempts: 3, // Default to 3 attempts as per spec
        createdAt: new Date(),
        resolve,
        reject,
      };

      this.queue.set(operationId, request);
      this.processRequest(operationId);
    });
  }

  /**
   * Process a queued request
   * @param requestId - Request ID to process
   */
  private async processRequest(requestId: string): Promise<void> {
    const request = this.queue.get(requestId);
    if (!request) {
      return;
    }

    try {
      console.log(
        `[AIQueue] Processing request ${requestId}, attempt ${request.attemptNumber}/${request.maxAttempts}`
      );

      const result = await request.operation();

      // Success - remove from queue and resolve
      this.queue.delete(requestId);
      this.clearRetryTimer(requestId);
      this.stats.totalProcessed++;

      if (request.attemptNumber > 1) {
        this.stats.successfulRetries++;
        console.log(
          `[AIQueue] Request ${requestId} succeeded after ${request.attemptNumber} attempts`
        );
      }

      request.resolve(result);
    } catch (error) {
      await this.handleRequestFailure(requestId, error);
    }
  }

  /**
   * Handle request failure and schedule retry if applicable
   * @param requestId - Request ID that failed
   * @param error - Error that occurred
   */
  private async handleRequestFailure(
    requestId: string,
    error: any
  ): Promise<void> {
    const request = this.queue.get(requestId);
    if (!request) {
      return;
    }

    // Convert to AIError if not already
    let aiError: AIError;
    if (error instanceof AIError) {
      aiError = error;
    } else {
      // Wrap generic errors
      aiError = new AIError(
        AIErrorCode.UNKNOWN_ERROR,
        error.message || 'Unknown error occurred',
        500
      );
    }

    request.lastError = aiError;

    console.error(
      `[AIQueue] Request ${requestId} failed (attempt ${request.attemptNumber}/${request.maxAttempts}):`,
      aiError.code,
      aiError.message
    );

    // Check if should retry
    if (aiError.shouldRetry(request.attemptNumber)) {
      // Schedule retry
      const retryDelay = aiError.calculateRetryDelay(request.attemptNumber);
      const nextRetryAt = new Date(Date.now() + retryDelay);

      request.attemptNumber++;
      request.nextRetryAt = nextRetryAt;

      console.log(
        `[AIQueue] Scheduling retry for ${requestId} in ${retryDelay}ms (at ${nextRetryAt.toISOString()})`
      );

      // Clear existing timer if any
      this.clearRetryTimer(requestId);

      // Schedule retry
      const timer = setTimeout(() => {
        this.processRequest(requestId);
      }, retryDelay);

      this.retryTimers.set(requestId, timer);
    } else {
      // No more retries - fail the request
      this.queue.delete(requestId);
      this.clearRetryTimer(requestId);
      this.stats.failed++;
      this.stats.totalProcessed++;

      console.error(
        `[AIQueue] Request ${requestId} exhausted all retries or is non-retryable`
      );

      request.reject(aiError);
    }
  }

  /**
   * Clear retry timer for a request
   * @param requestId - Request ID
   */
  private clearRetryTimer(requestId: string): void {
    const timer = this.retryTimers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(requestId);
    }
  }

  /**
   * Cancel a pending request
   * @param requestId - Request ID to cancel
   */
  cancelRequest(requestId: string): void {
    const request = this.queue.get(requestId);
    if (request) {
      this.clearRetryTimer(requestId);
      this.queue.delete(requestId);
      request.reject(new Error('Request cancelled'));
      console.log(`[AIQueue] Request ${requestId} cancelled`);
    }
  }

  /**
   * Get queue status
   * @returns Current queue statistics
   */
  getStatus(): RetryQueueStatus {
    return {
      pendingRequests: this.queue.size,
      failedRequests: this.stats.failed,
      successfulRetries: this.stats.successfulRetries,
      totalProcessed: this.stats.totalProcessed,
    };
  }

  /**
   * Get pending request details
   * @param requestId - Request ID
   * @returns Request details if pending
   */
  getRequestStatus(requestId: string): {
    attemptNumber: number;
    maxAttempts: number;
    nextRetryAt?: Date;
    lastError?: string;
  } | null {
    const request = this.queue.get(requestId);
    if (!request) {
      return null;
    }

    return {
      attemptNumber: request.attemptNumber,
      maxAttempts: request.maxAttempts,
      nextRetryAt: request.nextRetryAt,
      lastError: request.lastError?.getUserMessage(),
    };
  }

  /**
   * Clear all pending requests (for shutdown/testing)
   */
  clearAll(): void {
    // Clear all timers
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();

    // Reject all pending requests
    for (const request of this.queue.values()) {
      request.reject(new Error('Queue cleared'));
    }
    this.queue.clear();

    console.log('[AIQueue] All pending requests cleared');
  }

  /**
   * Reset statistics (for testing)
   */
  resetStats(): void {
    this.stats = {
      failed: 0,
      successfulRetries: 0,
      totalProcessed: 0,
    };
  }
}

// Singleton instance
let queueServiceInstance: AIQueueService | null = null;

/**
 * Get singleton queue service instance
 */
export function getQueueService(): AIQueueService {
  if (!queueServiceInstance) {
    queueServiceInstance = new AIQueueService();
  }
  return queueServiceInstance;
}

/**
 * Reset queue service (for testing)
 */
export function resetQueueService(): void {
  if (queueServiceInstance) {
    queueServiceInstance.clearAll();
    queueServiceInstance = null;
  }
}
