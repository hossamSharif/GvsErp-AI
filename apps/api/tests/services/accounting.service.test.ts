import { describe, it, expect } from 'vitest';
import { AccountingService, AccountingError } from '../../src/services/accounting.service';

/**
 * Unit tests for AccountingService pure business logic.
 * Tests error class, constructor, error codes — no DB mocks needed.
 */

const accountingService = new (AccountingService as any)(null);

// ==========================================================================
// AccountingError
// ==========================================================================

describe('AccountingError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new AccountingError('bad entry', 'BAD_ENTRY');
    expect(err.message).toBe('bad entry');
    expect(err.code).toBe('BAD_ENTRY');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('AccountingError');
  });

  it('allows overriding statusCode', () => {
    const err = new AccountingError('not found', 'ACCOUNT_NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new AccountingError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new AccountingError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('AccountingError');
  });
});

// ==========================================================================
// AccountingError — all error codes used in service
// ==========================================================================

describe('AccountingError specific codes', () => {
  it('creates PARENT_NOT_FOUND error', () => {
    const err = new AccountingError('Parent account not found', 'PARENT_NOT_FOUND', 404);
    expect(err.code).toBe('PARENT_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates TYPE_MISMATCH error', () => {
    const err = new AccountingError('Parent account must be of the same type', 'TYPE_MISMATCH');
    expect(err.code).toBe('TYPE_MISMATCH');
    expect(err.statusCode).toBe(400);
  });

  it('creates CODE_EXISTS error', () => {
    const err = new AccountingError('Account with code 1000 already exists', 'CODE_EXISTS');
    expect(err.code).toBe('CODE_EXISTS');
  });

  it('creates CIRCULAR_REFERENCE error', () => {
    const err = new AccountingError('Account cannot be its own parent', 'CIRCULAR_REFERENCE');
    expect(err.code).toBe('CIRCULAR_REFERENCE');
  });

  it('creates HAS_CHILDREN error', () => {
    const err = new AccountingError('Cannot delete account with child accounts', 'HAS_CHILDREN');
    expect(err.code).toBe('HAS_CHILDREN');
  });

  it('creates HAS_ENTRIES error', () => {
    const err = new AccountingError('Cannot delete account with journal entries', 'HAS_ENTRIES');
    expect(err.code).toBe('HAS_ENTRIES');
  });

  it('creates ACCOUNT_NOT_FOUND error', () => {
    const err = new AccountingError('Account not found', 'ACCOUNT_NOT_FOUND', 404);
    expect(err.code).toBe('ACCOUNT_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates UNBALANCED_ENTRY error', () => {
    const err = new AccountingError('Journal entry must be balanced', 'UNBALANCED_ENTRY');
    expect(err.code).toBe('UNBALANCED_ENTRY');
  });

  it('creates ENTRY_POSTED error', () => {
    const err = new AccountingError('Cannot update posted journal entry', 'ENTRY_POSTED');
    expect(err.code).toBe('ENTRY_POSTED');
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('AccountingService constructor', () => {
  it('initializes accountRepo', () => {
    expect(accountingService.accountRepo).toBeDefined();
  });

  it('initializes journalRepo', () => {
    expect(accountingService.journalRepo).toBeDefined();
  });
});
