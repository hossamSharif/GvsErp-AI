import { describe, it, expect, vi } from 'vitest';
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

  it('creates CANNOT_DELETE error for non-draft payroll runs', () => {
    const err = new PayrollError('Cannot delete non-draft payroll run', 'CANNOT_DELETE');
    expect(err.code).toBe('CANNOT_DELETE');
    expect(err.statusCode).toBe(400);
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

// ==========================================================================
// getPayrollSummary — data transformation
// ==========================================================================

describe('PayrollService.getPayrollSummary', () => {
  it('calculates totals from multiple completed runs', async () => {
    const svc = new (PayrollService as any)(null, 'tenant-1');
    svc.payrollRepository = {
      findWithFilters: vi.fn().mockResolvedValue({
        data: [
          { id: 'r1', period_start: '2026-01-01', period_end: '2026-01-31', total_amount: '5000', status: 'completed' },
          { id: 'r2', period_start: '2026-02-01', period_end: '2026-02-28', total_amount: '7500', status: 'completed' },
        ],
      }),
    };

    const summary = await svc.getPayrollSummary('2026-01-01', '2026-02-28');
    expect(summary.total_runs).toBe(2);
    expect(summary.total_gross).toBe(12500);
    expect(summary.total_net).toBe(12500);
    expect(summary.runs).toHaveLength(2);
    expect(summary.runs[0].total_gross).toBe(5000);
    expect(summary.runs[1].total_net).toBe(7500);
  });

  it('returns zero totals when no runs exist', async () => {
    const svc = new (PayrollService as any)(null, 'tenant-1');
    svc.payrollRepository = {
      findWithFilters: vi.fn().mockResolvedValue({ data: [] }),
    };

    const summary = await svc.getPayrollSummary('2026-01-01', '2026-01-31');
    expect(summary.total_runs).toBe(0);
    expect(summary.total_gross).toBe(0);
    expect(summary.total_net).toBe(0);
    expect(summary.runs).toHaveLength(0);
  });

  it('handles null total_amount gracefully', async () => {
    const svc = new (PayrollService as any)(null, 'tenant-1');
    svc.payrollRepository = {
      findWithFilters: vi.fn().mockResolvedValue({
        data: [
          { id: 'r1', period_start: '2026-03-01', period_end: '2026-03-31', total_amount: null, status: 'completed' },
        ],
      }),
    };

    const summary = await svc.getPayrollSummary('2026-03-01', '2026-03-31');
    expect(summary.total_gross).toBe(0);
    expect(summary.total_net).toBe(0);
    expect(summary.runs[0].total_gross).toBe(0);
  });

  it('maps run fields correctly', async () => {
    const svc = new (PayrollService as any)(null, 'tenant-1');
    svc.payrollRepository = {
      findWithFilters: vi.fn().mockResolvedValue({
        data: [
          { id: 'run-abc', period_start: '2026-04-01', period_end: '2026-04-30', total_amount: '3200.50', status: 'completed' },
        ],
      }),
    };

    const summary = await svc.getPayrollSummary('2026-04-01', '2026-04-30');
    const run = summary.runs[0];
    expect(run.id).toBe('run-abc');
    expect(run.period_start).toBe('2026-04-01');
    expect(run.period_end).toBe('2026-04-30');
    expect(run.status).toBe('completed');
    expect(run.total_gross).toBeCloseTo(3200.50);
  });
});
