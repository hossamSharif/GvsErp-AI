import { describe, it, expect } from 'vitest';
import { AuditService, AuditError } from '../../src/services/audit.service';

/**
 * Unit tests for AuditService pure business logic.
 * Tests private helpers via (instance as any) — no DB mocks needed.
 */

const auditService = new (AuditService as any)(null, 'test-tenant', 'test-user');

// ==========================================================================
// AuditError
// ==========================================================================

describe('AuditError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new AuditError('audit failure', 'AUDIT_FAILED');
    expect(err.message).toBe('audit failure');
    expect(err.code).toBe('AUDIT_FAILED');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('AuditError');
  });

  it('allows overriding statusCode', () => {
    const err = new AuditError('server error', 'LOG_FAILED', 500);
    expect(err.statusCode).toBe(500);
  });

  it('is an instance of Error', () => {
    const err = new AuditError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });
});

// ==========================================================================
// sanitizeValues
// ==========================================================================

describe('AuditService.sanitizeValues', () => {
  it('passes through non-sensitive fields unchanged', () => {
    const values = { name: 'John', email: 'john@example.com', role: 'admin' };
    const result = auditService.sanitizeValues(values);
    expect(result).toEqual(values);
  });

  it('redacts password fields', () => {
    const result = auditService.sanitizeValues({ password: 'secret123' });
    expect(result.password).toBe('[REDACTED]');
  });

  it('redacts token fields', () => {
    const result = auditService.sanitizeValues({
      access_token: 'abc123',
      refresh_token: 'xyz789',
    });
    expect(result.access_token).toBe('[REDACTED]');
    expect(result.refresh_token).toBe('[REDACTED]');
  });

  it('redacts api_key fields', () => {
    const result = auditService.sanitizeValues({ api_key: 'sk-12345' });
    expect(result.api_key).toBe('[REDACTED]');
  });

  it('redacts secret fields', () => {
    const result = auditService.sanitizeValues({ client_secret: 'mysecret' });
    expect(result.client_secret).toBe('[REDACTED]');
  });

  it('redacts credit_card fields', () => {
    const result = auditService.sanitizeValues({ credit_card: '4111111111111111' });
    expect(result.credit_card).toBe('[REDACTED]');
  });

  it('redacts ssn fields', () => {
    const result = auditService.sanitizeValues({ ssn: '123-45-6789' });
    expect(result.ssn).toBe('[REDACTED]');
  });

  it('redacts private_key fields', () => {
    const result = auditService.sanitizeValues({ private_key: '-----BEGIN RSA-----' });
    expect(result.private_key).toBe('[REDACTED]');
  });

  it('is case-insensitive when matching sensitive fields', () => {
    const result = auditService.sanitizeValues({
      PASSWORD: 'secret',
      Api_Key: 'key123',
      AccessToken: 'token',
    });
    expect(result.PASSWORD).toBe('[REDACTED]');
    expect(result.Api_Key).toBe('[REDACTED]');
    expect(result.AccessToken).toBe('[REDACTED]');
  });

  it('redacts fields containing sensitive substrings', () => {
    const result = auditService.sanitizeValues({
      user_password_hash: 'hashed',
      old_api_key_value: 'key',
    });
    expect(result.user_password_hash).toBe('[REDACTED]');
    expect(result.old_api_key_value).toBe('[REDACTED]');
  });

  it('handles empty object', () => {
    expect(auditService.sanitizeValues({})).toEqual({});
  });

  it('preserves non-string values for non-sensitive fields', () => {
    const values = { count: 42, active: true, tags: ['a', 'b'], nested: { x: 1 } };
    const result = auditService.sanitizeValues(values);
    expect(result).toEqual(values);
  });
});

// ==========================================================================
// calculateDiff
// ==========================================================================

describe('AuditService.calculateDiff', () => {
  it('returns empty array when both are null', () => {
    expect(AuditService.calculateDiff(null, null)).toEqual([]);
  });

  it('detects all fields as new when oldValues is null', () => {
    const changes = AuditService.calculateDiff(null, { name: 'Alice', age: 30 });
    expect(changes).toHaveLength(2);
    expect(changes).toContainEqual({ field: 'name', oldValue: undefined, newValue: 'Alice' });
    expect(changes).toContainEqual({ field: 'age', oldValue: undefined, newValue: 30 });
  });

  it('detects all fields as removed when newValues is null', () => {
    const changes = AuditService.calculateDiff({ name: 'Alice', age: 30 }, null);
    expect(changes).toHaveLength(2);
    expect(changes).toContainEqual({ field: 'name', oldValue: 'Alice', newValue: undefined });
    expect(changes).toContainEqual({ field: 'age', oldValue: 30, newValue: undefined });
  });

  it('returns empty array when values are identical', () => {
    const obj = { name: 'Alice', age: 30 };
    expect(AuditService.calculateDiff(obj, { ...obj })).toEqual([]);
  });

  it('detects changed fields', () => {
    const changes = AuditService.calculateDiff(
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 30 }
    );
    expect(changes).toEqual([{ field: 'name', oldValue: 'Alice', newValue: 'Bob' }]);
  });

  it('detects added fields', () => {
    const changes = AuditService.calculateDiff(
      { name: 'Alice' },
      { name: 'Alice', age: 30 }
    );
    expect(changes).toEqual([{ field: 'age', oldValue: undefined, newValue: 30 }]);
  });

  it('detects removed fields', () => {
    const changes = AuditService.calculateDiff(
      { name: 'Alice', age: 30 },
      { name: 'Alice' }
    );
    expect(changes).toEqual([{ field: 'age', oldValue: 30, newValue: undefined }]);
  });

  it('detects changes in nested objects', () => {
    const changes = AuditService.calculateDiff(
      { settings: { theme: 'dark' } },
      { settings: { theme: 'light' } }
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('settings');
  });

  it('detects changes in arrays', () => {
    const changes = AuditService.calculateDiff(
      { tags: ['a', 'b'] },
      { tags: ['a', 'c'] }
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('tags');
  });

  it('handles multiple simultaneous changes', () => {
    const changes = AuditService.calculateDiff(
      { a: 1, b: 2, c: 3 },
      { a: 10, b: 2, c: 30 }
    );
    expect(changes).toHaveLength(2);
    expect(changes.map((c) => c.field).sort()).toEqual(['a', 'c']);
  });
});

// ==========================================================================
// extractContext / getClientIp
// ==========================================================================

describe('AuditService.extractContext', () => {
  it('extracts x-forwarded-for IP', () => {
    const req = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } };
    const ctx = AuditService.extractContext(req);
    expect(ctx.ipAddress).toBe('1.2.3.4');
  });

  it('extracts x-real-ip when x-forwarded-for is absent', () => {
    const req = { headers: { 'x-real-ip': '10.0.0.1' } };
    const ctx = AuditService.extractContext(req);
    expect(ctx.ipAddress).toBe('10.0.0.1');
  });

  it('falls back to connection.remoteAddress', () => {
    const req = { headers: {}, connection: { remoteAddress: '127.0.0.1' } };
    const ctx = AuditService.extractContext(req);
    expect(ctx.ipAddress).toBe('127.0.0.1');
  });

  it('falls back to socket.remoteAddress', () => {
    const req = { headers: {}, socket: { remoteAddress: '::1' } };
    const ctx = AuditService.extractContext(req);
    expect(ctx.ipAddress).toBe('::1');
  });

  it('returns null IP when no source is available', () => {
    const req = { headers: {} };
    const ctx = AuditService.extractContext(req);
    expect(ctx.ipAddress).toBeNull();
  });

  it('extracts user-agent header', () => {
    const req = { headers: { 'user-agent': 'Mozilla/5.0' } };
    const ctx = AuditService.extractContext(req);
    expect(ctx.userAgent).toBe('Mozilla/5.0');
  });

  it('returns null userAgent when header is absent', () => {
    const req = { headers: {} };
    const ctx = AuditService.extractContext(req);
    expect(ctx.userAgent).toBeNull();
  });
});

// ==========================================================================
// mapAuditLog
// ==========================================================================

describe('AuditService.mapAuditLog', () => {
  const sampleRow = {
    id: 'log-1',
    tenant_id: 'tenant-1',
    user_id: 'user-1',
    user_email: 'user@test.com',
    user_name: 'Test User',
    action: 'create',
    entity_type: 'invoice',
    entity_id: 'inv-1',
    old_values: null,
    new_values: { total: 100 },
    ip_address: '1.2.3.4',
    user_agent: 'TestAgent/1.0',
    created_at: '2026-01-01T00:00:00Z',
  };

  it('maps all fields from database row to AuditLog', () => {
    const result = auditService.mapAuditLog(sampleRow);
    expect(result).toEqual({
      id: 'log-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      userEmail: 'user@test.com',
      userName: 'Test User',
      action: 'create',
      entityType: 'invoice',
      entityId: 'inv-1',
      oldValues: null,
      newValues: { total: 100 },
      ipAddress: '1.2.3.4',
      userAgent: 'TestAgent/1.0',
      createdAt: '2026-01-01T00:00:00Z',
    });
  });

  it('handles null optional fields', () => {
    const row = {
      ...sampleRow,
      user_email: null,
      user_name: null,
      entity_id: null,
      old_values: null,
      new_values: null,
      ip_address: null,
      user_agent: null,
    };
    const result = auditService.mapAuditLog(row);
    expect(result.userEmail).toBeNull();
    expect(result.userName).toBeNull();
    expect(result.entityId).toBeNull();
    expect(result.oldValues).toBeNull();
    expect(result.newValues).toBeNull();
    expect(result.ipAddress).toBeNull();
    expect(result.userAgent).toBeNull();
  });
});
