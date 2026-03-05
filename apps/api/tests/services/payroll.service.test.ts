import { describe, it, expect } from 'vitest';
import { PayrollService, PayrollError } from '../../src/services/payroll.service';

/**
 * Unit tests for PayrollService pure business logic.
 * Tests error class, constructor, error codes — no DB mocks needed.
 */

const payrollService = new (PayrollService as any)(null, 'test-tenant');

// ==========================================================================
// PayrollError
// ==========================================================================

describe('PayrollError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new PayrollError('bad data', 'BAD_DATA');
    expect(err.message).toBe('bad data');
    expect(err.code).toBe('BAD_DATA');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('PayrollError');
  });

  it('allows overriding statusCode', () => {
    const err = new PayrollError('not found', 'NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new PayrollError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new PayrollError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('PayrollError');
  });
});

// ==========================================================================
// PayrollError — all error codes used in service
// ==========================================================================

describe('PayrollError specific codes', () => {
  it('creates PAYROLL_NOT_FOUND error', () => {
    const err = new PayrollError('Payroll run not found', 'PAYROLL_NOT_FOUND', 404);
    expect(err.code).toBe('PAYROLL_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates INVALID_PERIOD error', () => {
    const err = new PayrollError('Period end must be after start', 'INVALID_PERIOD');
    expect(err.code).toBe('INVALID_PERIOD');
  });

  it('creates PAYROLL_EXISTS error', () => {
    const err = new PayrollError('Payroll already exists', 'PAYROLL_EXISTS');
    expect(err.code).toBe('PAYROLL_EXISTS');
  });

  it('creates PAYROLL_COMPLETED error', () => {
    const err = new PayrollError('Cannot modify completed payroll', 'PAYROLL_COMPLETED');
    expect(err.code).toBe('PAYROLL_COMPLETED');
  });

  it('creates ALREADY_COMPLETED error', () => {
    const err = new PayrollError('Payroll run already completed', 'ALREADY_COMPLETED');
    expect(err.code).toBe('ALREADY_COMPLETED');
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('PayrollService constructor', () => {
  it('stores tenantId', () => {
    expect(payrollService.tenantId).toBe('test-tenant');
  });

  it('initializes payrollRepository', () => {
    expect(payrollService.payrollRepository).toBeDefined();
  });

  it('initializes employeeRepository', () => {
    expect(payrollService.employeeRepository).toBeDefined();
  });

  it('initializes attendanceRepository', () => {
    expect(payrollService.attendanceRepository).toBeDefined();
  });
});
