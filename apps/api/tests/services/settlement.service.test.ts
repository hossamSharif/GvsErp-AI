import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SettlementService,
  SettlementError,
} from '../../src/services/settlement.service';
import {
  createSettlementSchema,
  settlementItemSchema,
} from '@erp/shared';

/**
 * Unit tests for SettlementService.
 *
 * The stock/valuation mechanics live in the post_settlement() Postgres function
 * and are exercised against the database, not here. These tests cover the
 * TypeScript side: status guards, what gets handed to the RPC, journal-entry
 * direction, reversal arithmetic, and error translation.
 */

function makeService(overrides: Record<string, unknown> = {}) {
  const service = new (SettlementService as any)(null, 'tenant-1');
  Object.assign(service, overrides);
  return service;
}

const postedSettlement = (over: Record<string, unknown> = {}) => ({
  id: 'stl-1',
  settlementNumber: 'ADJ-202608-0001',
  warehouseId: 'wh-1',
  warehouseName: 'Main',
  settlementDate: '2026-08-13',
  status: 'posted',
  reason: 'count_correction',
  reversalOfId: null,
  totalIncreaseValue: 0,
  totalDecreaseValue: 132,
  items: [],
  ...over,
});

// ==========================================================================
// SettlementError
// ==========================================================================

describe('SettlementError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new SettlementError('bad', 'BAD');
    expect(err.message).toBe('bad');
    expect(err.code).toBe('BAD');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('SettlementError');
    expect(err).toBeInstanceOf(Error);
  });

  it('allows overriding statusCode', () => {
    expect(new SettlementError('nope', 'NOT_FOUND', 404).statusCode).toBe(404);
  });
});

// ==========================================================================
// RPC error translation
// ==========================================================================

describe('translateRpcError', () => {
  const service = makeService();

  it.each([
    ['SETTLEMENT_NOT_FOUND', 'SETTLEMENT_NOT_FOUND', 404],
    ['SETTLEMENT_NOT_DRAFT', 'SETTLEMENT_NOT_DRAFT', 400],
    ['SETTLEMENT_NO_CHANGES', 'SETTLEMENT_NO_CHANGES', 400],
    ['SETTLEMENT_NEGATIVE_STOCK:abc', 'SETTLEMENT_NEGATIVE_STOCK', 400],
  ])('maps %s to a typed SettlementError', (raw, code, status) => {
    const err = service.translateRpcError({ message: `ERROR: ${raw}` });
    expect(err).toBeInstanceOf(SettlementError);
    expect(err.code).toBe(code);
    expect(err.statusCode).toBe(status);
  });

  it('passes unknown errors through untouched', () => {
    const original = { message: 'connection reset' };
    expect(service.translateRpcError(original)).toBe(original);
  });
});

// ==========================================================================
// postSettlement
// ==========================================================================

describe('postSettlement', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let generateJe: ReturnType<typeof vi.fn>;
  let updateHeader: ReturnType<typeof vi.fn>;

  function build(
    rpcRow: Record<string, unknown>,
    opts: {
      status?: string;
      accountingEnabled?: boolean;
      cogsEnabled?: boolean;
      jeResult?: unknown;
      jeThrows?: Error;
    } = {}
  ) {
    const {
      status = 'draft',
      accountingEnabled = true,
      cogsEnabled = true,
      jeResult = { id: 'je-1' },
      jeThrows,
    } = opts;

    rpc = vi.fn().mockResolvedValue({ data: [rpcRow], error: null });
    generateJe = jeThrows
      ? vi.fn().mockRejectedValue(jeThrows)
      : vi.fn().mockResolvedValue(jeResult);
    updateHeader = vi.fn().mockResolvedValue(undefined);

    const settlement = postedSettlement({
      status,
      items: [{ id: 'l1', itemId: 'i1', countedQuantity: 30 }],
    });

    return makeService({
      supabase: { rpc },
      getSettlement: vi.fn().mockResolvedValue(settlement),
      repo: { updateHeader },
      accountingService: {
        isEnabled: vi.fn().mockResolvedValue(accountingEnabled),
        isCogsEnabled: vi.fn().mockResolvedValue(cogsEnabled),
        generateJournalEntryFromSettlement: generateJe,
      },
    });
  }

  const shortageRow = {
    lines_applied: 1,
    increase_value: 0,
    decrease_value: 132,
    net_value_delta: -132,
  };

  it('refuses to post a non-draft settlement', async () => {
    const service = build(shortageRow, { status: 'posted' });
    await expect(service.postSettlement('stl-1')).rejects.toMatchObject({
      code: 'SETTLEMENT_NOT_DRAFT',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('passes the tenant, user and cogs flag to the RPC', async () => {
    const service = build(shortageRow, { cogsEnabled: false });
    await service.postSettlement('stl-1', 'user-9');

    expect(rpc).toHaveBeenCalledWith('post_settlement', {
      p_settlement_id: 'stl-1',
      p_tenant_id: 'tenant-1',
      p_user_id: 'user-9',
      p_cogs_enabled: false,
    });
  });

  it('posts the JE with the net value delta and links it to the document', async () => {
    const service = build(shortageRow);
    const result = await service.postSettlement('stl-1', 'user-9');

    expect(generateJe).toHaveBeenCalledWith(
      'tenant-1',
      'user-9',
      'stl-1',
      -132,
      '2026-08-13',
      expect.stringContaining('ADJ-202608-0001')
    );
    expect(updateHeader).toHaveBeenCalledWith('tenant-1', 'stl-1', {
      journalEntryId: 'je-1',
    });
    expect(result.journalEntryId).toBe('je-1');
    expect(result.netValueDelta).toBe(-132);
    expect(result.decreaseValue).toBe(132);
    expect(result.accountingWarning).toBeNull();
  });

  it('reports an overage as a positive net delta', async () => {
    const service = build({
      lines_applied: 1,
      increase_value: 60,
      decrease_value: 0,
      net_value_delta: 60,
    });
    const result = await service.postSettlement('stl-1');

    expect(result.increaseValue).toBe(60);
    expect(result.netValueDelta).toBe(60);
    expect(generateJe).toHaveBeenCalledWith(
      'tenant-1',
      null,
      'stl-1',
      60,
      expect.any(String),
      expect.any(String)
    );
  });

  it('skips accounting entirely when the module is off', async () => {
    const service = build(shortageRow, { accountingEnabled: false });
    const result = await service.postSettlement('stl-1');

    expect(generateJe).not.toHaveBeenCalled();
    expect(result.journalEntryId).toBeNull();
    expect(result.accountingWarning).toBeNull();
  });

  it('warns rather than failing when accounts are unmapped', async () => {
    const service = build(shortageRow, { jeResult: null });
    const result = await service.postSettlement('stl-1');

    expect(result.journalEntryId).toBeNull();
    expect(result.accountingWarning).toContain('Inventory Asset');
  });

  it('keeps the stock correction when the JE throws', async () => {
    const service = build(shortageRow, {
      jeThrows: new Error('account is a group'),
    });
    const result = await service.postSettlement('stl-1');

    expect(result.linesApplied).toBe(1);
    expect(result.journalEntryId).toBeNull();
    expect(result.accountingWarning).toContain('account is a group');
  });

  it('surfaces a translated error when the RPC rejects', async () => {
    const service = build(shortageRow);
    (service.supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'ERROR: SETTLEMENT_NO_CHANGES' },
    });

    await expect(service.postSettlement('stl-1')).rejects.toMatchObject({
      code: 'SETTLEMENT_NO_CHANGES',
    });
  });
});

// ==========================================================================
// reverseSettlement
// ==========================================================================

describe('reverseSettlement', () => {
  function build(settlement: Record<string, unknown>, currentQty: Map<string, number>) {
    return makeService({
      getSettlement: vi.fn().mockResolvedValue(settlement),
      getSystemQuantities: vi.fn().mockResolvedValue(currentQty),
      repo: {
        findReversalOf: vi.fn().mockResolvedValue(null),
        generateSettlementNumber: vi.fn().mockResolvedValue('ADJ-202608-0002'),
        createWithItems: vi.fn().mockResolvedValue('stl-2'),
        updateHeader: vi.fn().mockResolvedValue(undefined),
      },
      postSettlement: vi.fn().mockResolvedValue({
        settlement: postedSettlement({ id: 'stl-2' }),
        journalEntryId: 'je-2',
      }),
      accountingService: {
        reverseEntry: vi.fn().mockResolvedValue({ id: 'je-rev' }),
      },
    });
  }

  it('refuses to reverse a draft', async () => {
    const service = build(postedSettlement({ status: 'draft' }), new Map());
    await expect(service.reverseSettlement('stl-1')).rejects.toMatchObject({
      code: 'SETTLEMENT_NOT_POSTED',
    });
  });

  it('refuses to reverse a reversal', async () => {
    const service = build(
      postedSettlement({ reversalOfId: 'stl-0' }),
      new Map()
    );
    await expect(service.reverseSettlement('stl-1')).rejects.toMatchObject({
      code: 'SETTLEMENT_IS_REVERSAL',
    });
  });

  it('refuses to reverse the same settlement twice', async () => {
    const service = build(postedSettlement(), new Map());
    service.repo.findReversalOf.mockResolvedValue({
      id: 'stl-2',
      settlementNumber: 'ADJ-202608-0002',
    });

    await expect(service.reverseSettlement('stl-1')).rejects.toMatchObject({
      code: 'SETTLEMENT_ALREADY_REVERSED',
    });
    expect(service.repo.createWithItems).not.toHaveBeenCalled();
  });

  it('counts each item back by undoing the applied difference', async () => {
    // Original removed 6 units (36 -> 30). Stock is still 30, so reversing
    // should count back up to 36.
    const settlement = postedSettlement({
      items: [
        {
          id: 'l1',
          itemId: 'i1',
          itemName: 'Widget',
          differenceQuantity: -6,
          unitCost: 22,
        },
      ],
    });
    const service = build(settlement, new Map([['i1', 30]]));

    await service.reverseSettlement('stl-1', 'user-9');

    const [, header, items] = service.repo.createWithItems.mock.calls[0];
    expect(header.reversalOfId).toBe('stl-1');
    expect(items).toEqual([
      expect.objectContaining({ itemId: 'i1', countedQuantity: 36, unitCost: 22 }),
    ]);
  });

  it('accounts for stock that moved after posting', async () => {
    // Original added 10 units. 4 have since been sold (on-hand now 6), so
    // undoing the +10 would imply -4: reject with a clear message.
    const settlement = postedSettlement({
      items: [
        {
          id: 'l1',
          itemId: 'i1',
          itemName: 'Widget',
          differenceQuantity: 10,
          unitCost: 5,
        },
      ],
    });
    const service = build(settlement, new Map([['i1', 6]]));

    await expect(service.reverseSettlement('stl-1')).rejects.toMatchObject({
      code: 'SETTLEMENT_REVERSAL_NEGATIVE',
    });
    expect(service.repo.createWithItems).not.toHaveBeenCalled();
  });

  it('marks the original canceled and reverses its journal entry', async () => {
    const settlement = postedSettlement({
      items: [
        { id: 'l1', itemId: 'i1', itemName: 'W', differenceQuantity: -6, unitCost: 22 },
      ],
    });
    const service = build(settlement, new Map([['i1', 30]]));

    const result = await service.reverseSettlement('stl-1', 'user-9');

    expect(service.accountingService.reverseEntry).toHaveBeenCalledWith(
      'tenant-1',
      'user-9',
      'settlement',
      'stl-1',
      expect.stringContaining('ADJ-202608-0001')
    );
    expect(service.repo.updateHeader).toHaveBeenCalledWith('tenant-1', 'stl-1', {
      status: 'canceled',
    });
    expect(result.journalEntryId).toBe('je-rev');
  });

  it('rejects when the document changed no quantities', async () => {
    const settlement = postedSettlement({
      items: [
        { id: 'l1', itemId: 'i1', itemName: 'W', differenceQuantity: 0, unitCost: 1 },
      ],
    });
    const service = build(settlement, new Map([['i1', 10]]));

    await expect(service.reverseSettlement('stl-1')).rejects.toMatchObject({
      code: 'SETTLEMENT_NO_CHANGES',
    });
  });
});

// ==========================================================================
// Validation
// ==========================================================================

describe('settlement validation', () => {
  const base = {
    warehouseId: '11111111-1111-4111-8111-111111111111',
    items: [
      { itemId: '22222222-2222-4222-8222-222222222222', countedQuantity: 5, unitCost: 2 },
    ],
  };

  it('accepts a well-formed document', () => {
    expect(createSettlementSchema.safeParse(base).success).toBe(true);
  });

  it('defaults reason to count_correction', () => {
    const parsed = createSettlementSchema.parse(base);
    expect(parsed.reason).toBe('count_correction');
  });

  it('allows a counted quantity of zero (everything is missing)', () => {
    expect(settlementItemSchema.safeParse({
      itemId: base.items[0].itemId,
      countedQuantity: 0,
      unitCost: 1,
    }).success).toBe(true);
  });

  it('rejects a negative counted quantity — this is what keeps stock >= 0', () => {
    expect(settlementItemSchema.safeParse({
      itemId: base.items[0].itemId,
      countedQuantity: -1,
      unitCost: 1,
    }).success).toBe(false);
  });

  it('rejects a negative unit cost', () => {
    expect(settlementItemSchema.safeParse({
      itemId: base.items[0].itemId,
      countedQuantity: 1,
      unitCost: -5,
    }).success).toBe(false);
  });

  it('rejects the same item twice in one document', () => {
    const result = createSettlementSchema.safeParse({
      ...base,
      items: [base.items[0], { ...base.items[0], countedQuantity: 9 }],
    });
    expect(result.success).toBe(false);
  });

  it('requires at least one line', () => {
    expect(createSettlementSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });
});
