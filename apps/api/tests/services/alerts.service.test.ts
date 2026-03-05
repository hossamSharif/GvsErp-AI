import { describe, it, expect } from 'vitest';
import { AlertsService } from '../../src/services/alerts.service';
import type { AlertSeverity } from '../../src/services/alerts.service';

/**
 * Unit tests for AlertsService pure business logic.
 * Tests getSeverity thresholds and constructor — no DB mocks needed.
 */

const alertsService = new (AlertsService as any)(null, 'test-tenant');

// ==========================================================================
// getSeverity — alert severity classification
// ==========================================================================

describe('AlertsService.getSeverity', () => {
  it('returns critical for 0%', () => {
    expect(alertsService.getSeverity(0)).toBe('critical');
  });

  it('returns critical for 24%', () => {
    expect(alertsService.getSeverity(24)).toBe('critical');
  });

  it('returns warning for 25%', () => {
    expect(alertsService.getSeverity(25)).toBe('warning');
  });

  it('returns warning for 49%', () => {
    expect(alertsService.getSeverity(49)).toBe('warning');
  });

  it('returns low for 50%', () => {
    expect(alertsService.getSeverity(50)).toBe('low');
  });

  it('returns low for 99%', () => {
    expect(alertsService.getSeverity(99)).toBe('low');
  });

  it('returns low for 100%', () => {
    expect(alertsService.getSeverity(100)).toBe('low');
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('AlertsService constructor', () => {
  it('stores tenantId', () => {
    expect(alertsService.tenantId).toBe('test-tenant');
  });

  it('initializes inventoryRepo', () => {
    expect(alertsService.inventoryRepo).toBeDefined();
  });

  it('initializes warehouseRepo', () => {
    expect(alertsService.warehouseRepo).toBeDefined();
  });
});
