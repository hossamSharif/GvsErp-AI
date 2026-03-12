import { describe, it, expect, vi } from 'vitest';
import { EmployeeService, EmployeeError } from '../../src/services/employee.service';

/**
 * Unit tests for EmployeeService pure business logic.
 * Tests error class, constructor, error codes — no DB mocks needed.
 */

const employeeService = new (EmployeeService as any)(null, 'test-tenant');

// ==========================================================================
// EmployeeError
// ==========================================================================

describe('EmployeeError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new EmployeeError('bad employee', 'BAD_EMPLOYEE');
    expect(err.message).toBe('bad employee');
    expect(err.code).toBe('BAD_EMPLOYEE');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('EmployeeError');
  });

  it('allows overriding statusCode', () => {
    const err = new EmployeeError('not found', 'EMPLOYEE_NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new EmployeeError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new EmployeeError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('EmployeeError');
  });
});

// ==========================================================================
// EmployeeError — all error codes used in service
// ==========================================================================

describe('EmployeeError specific codes', () => {
  it('creates EMPLOYEE_NOT_FOUND error', () => {
    const err = new EmployeeError('Employee not found', 'EMPLOYEE_NOT_FOUND', 404);
    expect(err.code).toBe('EMPLOYEE_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates UPDATE_FAILED error', () => {
    const err = new EmployeeError('Failed to update employee', 'UPDATE_FAILED', 500);
    expect(err.code).toBe('UPDATE_FAILED');
    expect(err.statusCode).toBe(500);
  });

  it('creates EMPLOYEE_NUMBER_EXISTS error', () => {
    const err = new EmployeeError('Employee number already exists', 'EMPLOYEE_NUMBER_EXISTS');
    expect(err.code).toBe('EMPLOYEE_NUMBER_EXISTS');
  });

  it('creates HAS_RECORDS error', () => {
    const err = new EmployeeError('Cannot delete employee with records', 'HAS_RECORDS');
    expect(err.code).toBe('HAS_RECORDS');
  });

  it('creates USER_ALREADY_LINKED error', () => {
    const err = new EmployeeError('User already linked to an employee', 'USER_ALREADY_LINKED');
    expect(err.code).toBe('USER_ALREADY_LINKED');
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('EmployeeService constructor', () => {
  it('stores tenantId', () => {
    expect(employeeService.tenantId).toBe('test-tenant');
  });

  it('initializes employeeRepository', () => {
    expect(employeeService.employeeRepository).toBeDefined();
  });
});

// ==========================================================================
// generateEmployeeNumber
// ==========================================================================

function createMockSupabaseForGenerate(result: { data: any; error: any }) {
  const limit = vi.fn().mockResolvedValue(result);
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  return { from: vi.fn().mockReturnValue({ select }) };
}

describe('EmployeeService.generateEmployeeNumber', () => {
  it('returns EMP-0001 when no employees exist', async () => {
    const mock = createMockSupabaseForGenerate({ data: [], error: null });
    const svc = new (EmployeeService as any)(mock, 'tenant-1');

    const result = await svc.generateEmployeeNumber();
    expect(result).toBe('EMP-0001');
  });

  it('returns EMP-0001 when data is null', async () => {
    const mock = createMockSupabaseForGenerate({ data: null, error: null });
    const svc = new (EmployeeService as any)(mock, 'tenant-1');

    const result = await svc.generateEmployeeNumber();
    expect(result).toBe('EMP-0001');
  });

  it('increments from the last employee number', async () => {
    const mock = createMockSupabaseForGenerate({
      data: [{ employee_number: 'EMP-0042' }],
      error: null,
    });
    const svc = new (EmployeeService as any)(mock, 'tenant-1');

    const result = await svc.generateEmployeeNumber();
    expect(result).toBe('EMP-0043');
  });

  it('pads number to 4 digits', async () => {
    const mock = createMockSupabaseForGenerate({
      data: [{ employee_number: 'EMP-0009' }],
      error: null,
    });
    const svc = new (EmployeeService as any)(mock, 'tenant-1');

    const result = await svc.generateEmployeeNumber();
    expect(result).toBe('EMP-0010');
  });

  it('handles large employee numbers', async () => {
    const mock = createMockSupabaseForGenerate({
      data: [{ employee_number: 'EMP-9999' }],
      error: null,
    });
    const svc = new (EmployeeService as any)(mock, 'tenant-1');

    const result = await svc.generateEmployeeNumber();
    expect(result).toBe('EMP-10000');
  });

  it('falls back to EMP-0001 for non-matching format', async () => {
    const mock = createMockSupabaseForGenerate({
      data: [{ employee_number: 'CUSTOM-ID-123' }],
      error: null,
    });
    const svc = new (EmployeeService as any)(mock, 'tenant-1');

    const result = await svc.generateEmployeeNumber();
    expect(result).toBe('EMP-0001');
  });

  it('throws on database error', async () => {
    const mock = createMockSupabaseForGenerate({
      data: null,
      error: { message: 'db error' },
    });
    const svc = new (EmployeeService as any)(mock, 'tenant-1');

    await expect(svc.generateEmployeeNumber()).rejects.toThrow();
  });
});
