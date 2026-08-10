import { describe, it, expect } from 'vitest';
import { classifyReplayFailure } from './replay';

describe('classifyReplayFailure', () => {
  it('blocks 4xx rejections the server will repeat identically', () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(classifyReplayFailure(status)).toBe('blocked');
    }
  });

  it('keeps retrying self-resolving 4xx statuses', () => {
    expect(classifyReplayFailure(408)).toBe('retry');
    expect(classifyReplayFailure(429)).toBe('retry');
  });

  it('keeps retrying server errors', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(classifyReplayFailure(status)).toBe('retry');
    }
  });

  it('keeps retrying transport failures with no status', () => {
    expect(classifyReplayFailure(undefined)).toBe('retry');
    expect(classifyReplayFailure(NaN)).toBe('retry');
  });
});
