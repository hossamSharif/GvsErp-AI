import { describe, it, expect } from 'vitest';
import { AttendanceService, AttendanceError } from '../../src/services/attendance.service';

/**
 * Unit tests for AttendanceService pure business logic.
 * Tests error class, constructor, error codes — no DB mocks needed.
 */

const attendanceService = new (AttendanceService as any)(null, 'test-tenant');

// ==========================================================================
// AttendanceError
// ==========================================================================

describe('AttendanceError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new AttendanceError('bad record', 'BAD_RECORD');
    expect(err.message).toBe('bad record');
    expect(err.code).toBe('BAD_RECORD');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('AttendanceError');
  });

  it('allows overriding statusCode', () => {
    const err = new AttendanceError('not found', 'RECORD_NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new AttendanceError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new AttendanceError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('AttendanceError');
  });
});

// ==========================================================================
// AttendanceError — all error codes used in service
// ==========================================================================

describe('AttendanceError specific codes', () => {
  it('creates EMPLOYEE_NOT_FOUND error', () => {
    const err = new AttendanceError('Employee not found', 'EMPLOYEE_NOT_FOUND', 404);
    expect(err.code).toBe('EMPLOYEE_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates EMPLOYEE_INACTIVE error', () => {
    const err = new AttendanceError('Employee is inactive', 'EMPLOYEE_INACTIVE');
    expect(err.code).toBe('EMPLOYEE_INACTIVE');
  });

  it('creates ALREADY_CHECKED_IN error', () => {
    const err = new AttendanceError('Already checked in', 'ALREADY_CHECKED_IN');
    expect(err.code).toBe('ALREADY_CHECKED_IN');
  });

  it('creates ALREADY_CHECKED_OUT error', () => {
    const err = new AttendanceError('Already checked out', 'ALREADY_CHECKED_OUT');
    expect(err.code).toBe('ALREADY_CHECKED_OUT');
  });

  it('creates NO_CHECK_IN error', () => {
    const err = new AttendanceError('No check-in found', 'NO_CHECK_IN');
    expect(err.code).toBe('NO_CHECK_IN');
  });

  it('creates RECORD_NOT_FOUND error', () => {
    const err = new AttendanceError('Record not found', 'RECORD_NOT_FOUND', 404);
    expect(err.code).toBe('RECORD_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates UPDATE_FAILED error', () => {
    const err = new AttendanceError('Failed to update record', 'UPDATE_FAILED', 500);
    expect(err.code).toBe('UPDATE_FAILED');
    expect(err.statusCode).toBe(500);
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('AttendanceService constructor', () => {
  it('stores tenantId', () => {
    expect(attendanceService.tenantId).toBe('test-tenant');
  });

  it('initializes attendanceRepository', () => {
    expect(attendanceService.attendanceRepository).toBeDefined();
  });

  it('initializes employeeRepository', () => {
    expect(attendanceService.employeeRepository).toBeDefined();
  });
});
