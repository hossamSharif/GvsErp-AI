import { describe, it, expect } from 'vitest';
import { BaseRepository } from '../../src/repositories/base.repository';

/**
 * Unit tests for BaseRepository static utilities.
 */

// ==========================================================================
// escapeILike
// ==========================================================================

describe('BaseRepository.escapeILike', () => {
  it('returns plain text unchanged', () => {
    expect(BaseRepository.escapeILike('hello')).toBe('hello');
  });

  it('escapes percent wildcard', () => {
    expect(BaseRepository.escapeILike('100%')).toBe('100\\%');
  });

  it('escapes underscore wildcard', () => {
    expect(BaseRepository.escapeILike('a_b')).toBe('a\\_b');
  });

  it('escapes backslash', () => {
    expect(BaseRepository.escapeILike('a\\b')).toBe('a\\\\b');
  });

  it('escapes all special characters together', () => {
    expect(BaseRepository.escapeILike('100%_test\\end')).toBe('100\\%\\_test\\\\end');
  });

  it('handles empty string', () => {
    expect(BaseRepository.escapeILike('')).toBe('');
  });

  it('handles string with only wildcards', () => {
    expect(BaseRepository.escapeILike('%_%')).toBe('\\%\\_\\%');
  });

  it('handles multiple consecutive percent signs', () => {
    expect(BaseRepository.escapeILike('%%')).toBe('\\%\\%');
  });

  it('preserves spaces and normal characters', () => {
    expect(BaseRepository.escapeILike('hello world 123')).toBe('hello world 123');
  });

  it('handles unicode characters', () => {
    expect(BaseRepository.escapeILike('مرحبا')).toBe('مرحبا');
  });
});

// ==========================================================================
// assertUuid
// ==========================================================================

describe('BaseRepository.assertUuid', () => {
  const assertUuid = (BaseRepository as any).assertUuid.bind(BaseRepository);

  it('accepts valid UUID v4', () => {
    expect(assertUuid('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('accepts uppercase UUID', () => {
    expect(assertUuid('550E8400-E29B-41D4-A716-446655440000')).toBe('550E8400-E29B-41D4-A716-446655440000');
  });

  it('rejects empty string', () => {
    expect(() => assertUuid('')).toThrow('Invalid UUID format');
  });

  it('rejects non-UUID string', () => {
    expect(() => assertUuid('not-a-uuid')).toThrow('Invalid UUID format');
  });

  it('rejects UUID with filter injection payload', () => {
    expect(() => assertUuid('abc,status.eq.completed')).toThrow('Invalid UUID format');
  });

  it('rejects UUID-like string with extra characters', () => {
    expect(() => assertUuid('550e8400-e29b-41d4-a716-446655440000-extra')).toThrow('Invalid UUID format');
  });

  it('rejects UUID without dashes', () => {
    expect(() => assertUuid('550e8400e29b41d4a716446655440000')).toThrow('Invalid UUID format');
  });

  it('rejects UUID with wrong segment lengths', () => {
    expect(() => assertUuid('550e840-0e29b-41d4-a716-446655440000')).toThrow('Invalid UUID format');
  });
});
