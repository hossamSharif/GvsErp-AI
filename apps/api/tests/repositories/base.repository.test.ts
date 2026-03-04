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
