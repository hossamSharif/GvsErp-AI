/**
 * Offline write engine
 *
 * Produces locally-finalized operational records when offline, using the shared
 * deterministic math (`@erp/offline-engine`) so results match the server. Each
 * write also enqueues a mutation in the outbox to replay on reconnect.
 *
 * What runs locally: line totals, document totals, stock decrement, party
 * balance delta, temporary `OFF-` numbers.
 * What is DEFERRED to the server on sync: the canonical sequential number,
 * FIFO COGS, and accounting journal posting. Nothing here touches accounting.
 */

import {
  calculateLineTotal,
  computeInvoiceTotals,
  computePartyBalanceDelta,
  stockQuantityChange,
  tempInvoiceNumber,
  newId,
} from '@erp/offline-engine';
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  CreatePaymentInput,
  InvoiceWithRelations,
  InvoiceItemWithDetails,
  Payment,
} from '@erp/shared';
import { getDB, inventoryKey, type CachedRecord } from './db';
import { enqueue } from './outbox';

interface OkEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

async function getContext(): Promise<{ tenantId: string; userId: string | null }> {
  const db = getDB();
  const a = await db.authLocal.get('current');
  return { tenantId: a?.tenantId ?? 'offline', userId: a?.userId ?? null };
}

function nowIso(): string {
  return new Date().toISOString();
}

function lineOf(it: CreateInvoiceInput['items'][number]) {
  return {
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    discountPercent: it.discountPercent ?? 0,
    taxRate: it.taxRate ?? 0,
  };
}

/** Build the embedded party snapshot for an invoice/payment record. */
async function partySnapshot(partyId: string | null | undefined) {
  if (!partyId) return null;
  const p = (await getDB().parties.get(partyId)) as CachedRecord | undefined;
  if (!p) return null;
  return {
    id: String(p.id),
    name: String(p.name ?? ''),
    type: (p.type as 'customer' | 'supplier') ?? 'customer',
    balance: Number(p.balance ?? 0),
    email: (p.email as string) ?? null,
    phone: (p.phone as string) ?? null,
    address: (p.address as string) ?? null,
  };
}

async function warehouseSnapshot(warehouseId: string) {
  const w = (await getDB().warehouses.get(warehouseId)) as CachedRecord | undefined;
  return { id: warehouseId, name: w ? String(w.name ?? '') : '' };
}

async function buildInvoiceItems(
  invoiceId: string,
  tenantId: string,
  input: CreateInvoiceInput
): Promise<InvoiceItemWithDetails[]> {
  const db = getDB();
  const details = await db.items.bulkGet(input.items.map((i) => i.itemId));
  const now = nowIso();
  return input.items.map((it, idx) => {
    const d = details[idx] as CachedRecord | undefined;
    return {
      id: newId(),
      invoiceId,
      tenantId,
      itemId: it.itemId,
      description: it.description ?? null,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountPercent: it.discountPercent ?? 0,
      taxRate: it.taxRate ?? 0,
      lineTotal: calculateLineTotal(lineOf(it)),
      sortOrder: it.sortOrder ?? idx,
      createdAt: now,
      item: {
        id: it.itemId,
        name: d ? String(d.name ?? '') : '',
        sku: (d?.sku as string) ?? null,
        barcode: (d?.barcode as string) ?? null,
        unitOfMeasure: d ? String(d.unitOfMeasure ?? '') : '',
      },
    };
  });
}

/** Create a DRAFT invoice offline. */
export async function createInvoiceOffline(
  input: CreateInvoiceInput
): Promise<OkEnvelope<InvoiceWithRelations>> {
  const db = getDB();
  const { tenantId, userId } = await getContext();
  const id = newId();
  const now = nowIso();

  const totals = computeInvoiceTotals(input.items.map(lineOf), input.discountAmount ?? 0);
  const items = await buildInvoiceItems(id, tenantId, input);

  const invoice: InvoiceWithRelations = {
    id,
    tenantId,
    invoiceNumber: tempInvoiceNumber(id),
    type: input.type,
    status: 'draft',
    partyId: input.partyId ?? null,
    warehouseId: input.warehouseId,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    discountAmount: input.discountAmount ?? 0,
    total: totals.total,
    currency: input.currency ?? 'USD',
    exchangeRate: input.exchangeRate ?? 1,
    notes: input.notes ?? null,
    createdBy: userId,
    returnedFromId: null,
    invoiceDate: input.invoiceDate ?? now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
    finalizedAt: null,
    party: await partySnapshot(input.partyId),
    warehouse: await warehouseSnapshot(input.warehouseId),
    items,
  };

  await db.invoices.put({ ...(invoice as object), _syncedAt: now } as CachedRecord);
  await db.invoiceItems.bulkPut(items.map((i) => ({ ...(i as object), _syncedAt: now } as CachedRecord)));

  await enqueue({
    type: 'invoice.create',
    entityLocalId: id,
    endpoint: '/invoices',
    method: 'POST',
    // Include the client id so the server can upsert idempotently on replay.
    payload: { ...input, id },
  });

  return { success: true, data: invoice };
}

/** Update a DRAFT invoice offline. */
export async function updateInvoiceOffline(
  id: string,
  data: UpdateInvoiceInput
): Promise<OkEnvelope<InvoiceWithRelations>> {
  const db = getDB();
  const existing = (await db.invoices.get(id)) as unknown as InvoiceWithRelations | undefined;
  if (!existing) {
    throw new Error('Invoice not available offline');
  }
  const { tenantId } = await getContext();
  const now = nowIso();

  const mergedItemsInput: CreateInvoiceInput['items'] =
    data.items?.map((it) => ({
      itemId: it.itemId,
      description: it.description ?? null,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountPercent: it.discountPercent ?? 0,
      taxRate: it.taxRate ?? 0,
      sortOrder: it.sortOrder,
    })) ?? existing.items.map((i) => ({
      itemId: i.itemId,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discountPercent: i.discountPercent,
      taxRate: i.taxRate,
      sortOrder: i.sortOrder,
    }));

  const totals = computeInvoiceTotals(
    mergedItemsInput.map(lineOf),
    data.discountAmount ?? existing.discountAmount
  );
  const items = await buildInvoiceItems(id, tenantId, {
    type: existing.type,
    warehouseId: data.warehouseId ?? existing.warehouseId,
    items: mergedItemsInput,
  });

  const updated: InvoiceWithRelations = {
    ...existing,
    partyId: data.partyId ?? existing.partyId,
    warehouseId: data.warehouseId ?? existing.warehouseId,
    currency: data.currency ?? existing.currency,
    exchangeRate: data.exchangeRate ?? existing.exchangeRate,
    discountAmount: data.discountAmount ?? existing.discountAmount,
    notes: data.notes ?? existing.notes,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    total: totals.total,
    updatedAt: now,
    party: await partySnapshot(data.partyId ?? existing.partyId),
    warehouse: await warehouseSnapshot(data.warehouseId ?? existing.warehouseId),
    items,
  };

  await db.invoices.put({ ...(updated as object), _syncedAt: now } as CachedRecord);
  await db.invoiceItems.where('invoiceId').equals(id).delete();
  await db.invoiceItems.bulkPut(items.map((i) => ({ ...(i as object), _syncedAt: now } as CachedRecord)));

  await enqueue({
    type: 'invoice.create', // update-before-sync folds into the create payload
    entityLocalId: id,
    endpoint: `/invoices/${id}`,
    method: 'PUT',
    payload: data,
  });

  return { success: true, data: updated };
}

/** Find an unsynced outbox entry for an entity (to wire up dependencies). */
async function openEntryId(entityLocalId: string): Promise<string | undefined> {
  const db = getDB();
  const entries = await db.outbox.where('entityLocalId').equals(entityLocalId).toArray();
  const open = entries.find((e) => e.status === 'pending' || e.status === 'failed');
  return open?.id;
}

/**
 * Finalize an invoice offline: validate stock, decrement inventory, apply the
 * party-balance delta, flip status to final. Accounting + COGS + the real
 * number are deferred to the server on sync.
 */
export async function finalizeInvoiceOffline(
  id: string
): Promise<OkEnvelope<InvoiceWithRelations>> {
  const db = getDB();
  const invoice = (await db.invoices.get(id)) as unknown as InvoiceWithRelations | undefined;
  if (!invoice) throw new Error('Invoice not available offline');
  if (invoice.status === 'final') return { success: true, data: invoice };

  const now = nowIso();
  const isSale = invoice.type === 'sale';

  // 1) Validate + apply stock movements against the local inventory mirror.
  const movements: NonNullable<unknown>[] = [];
  for (const line of invoice.items) {
    const key = inventoryKey(invoice.warehouseId, line.itemId);
    const inv = await db.inventory.get(key);
    const previousQuantity = inv ? Number(inv.quantity) : 0;
    if (isSale && previousQuantity < line.quantity) {
      throw new Error(
        `Insufficient stock for ${line.item?.name || line.itemId} (have ${previousQuantity}, need ${line.quantity})`
      );
    }
    const change = stockQuantityChange(invoice.type, line.quantity);
    const newQuantity = previousQuantity + change;
    await db.inventory.put({
      whItem: key,
      warehouseId: invoice.warehouseId,
      itemId: line.itemId,
      quantity: newQuantity,
      _syncedAt: now,
    });
    movements.push({
      itemId: line.itemId,
      warehouseId: invoice.warehouseId,
      quantityChange: change,
      previousQuantity,
      newQuantity,
    });
  }

  // 2) Apply party balance delta to the cached party (matches the DB trigger).
  let partyBalanceUpdate: Record<string, unknown> | undefined;
  if (invoice.partyId) {
    const party = (await db.parties.get(invoice.partyId)) as CachedRecord | undefined;
    if (party) {
      const previousBalance = Number(party.balance ?? 0);
      const delta = computePartyBalanceDelta({
        kind: 'invoice_finalize',
        total: invoice.total,
        exchangeRate: invoice.exchangeRate,
      });
      const newBalance = previousBalance + delta;
      await db.parties.put({ ...party, balance: newBalance, _syncedAt: now });
      partyBalanceUpdate = {
        partyId: invoice.partyId,
        previousBalance,
        newBalance,
        change: delta,
      };
    }
  }

  // 3) Flip status to final with a temp number until the server renumbers.
  const finalized: InvoiceWithRelations = {
    ...invoice,
    status: 'final',
    finalizedAt: now,
    updatedAt: now,
    party: await partySnapshot(invoice.partyId),
  };
  await db.invoices.put({ ...(finalized as object), _syncedAt: now } as CachedRecord);

  // 4) Enqueue finalize, dependent on a still-pending create for this invoice.
  const dependsOnId = await openEntryId(id);
  await enqueue({
    type: 'invoice.finalize',
    entityLocalId: id,
    endpoint: `/invoices/${id}/finalize`,
    method: 'POST',
    payload: {},
    dependsOn: dependsOnId ? [dependsOnId] : [],
  });

  return {
    success: true,
    data: finalized,
    meta: { stockMovements: movements, partyBalanceUpdate },
  };
}

/** Record a payment offline and apply the party-balance delta. */
export async function createPaymentOffline(
  input: CreatePaymentInput
): Promise<OkEnvelope<Payment>> {
  const db = getDB();
  const { tenantId, userId } = await getContext();
  const id = newId();
  const now = nowIso();

  const payment: Payment = {
    id,
    tenantId,
    partyId: input.partyId,
    type: input.type,
    amount: input.amount,
    currency: input.currency ?? 'USD',
    exchangeRate: input.exchangeRate ?? 1,
    paymentMethod: input.paymentMethod ?? null,
    reference: input.reference ?? null,
    invoiceId: input.invoiceId ?? null,
    notes: input.notes ?? null,
    paymentDate: input.paymentDate ?? now,
    createdBy: userId,
    createdAt: now,
  };
  await db.payments.put({ ...(payment as object), _syncedAt: now } as CachedRecord);

  // Apply balance delta (payment reduces the party's outstanding balance).
  const party = (await db.parties.get(input.partyId)) as CachedRecord | undefined;
  if (party) {
    const delta = computePartyBalanceDelta({
      kind: 'payment',
      amount: input.amount,
      exchangeRate: input.exchangeRate ?? 1,
    });
    await db.parties.put({ ...party, balance: Number(party.balance ?? 0) + delta, _syncedAt: now });
  }

  // A payment against an offline invoice must sync after that invoice.
  const dependsOnId = input.invoiceId ? await openEntryId(input.invoiceId) : undefined;
  await enqueue({
    type: 'payment.create',
    entityLocalId: id,
    endpoint: '/payments',
    method: 'POST',
    payload: { ...input, id },
    dependsOn: dependsOnId ? [dependsOnId] : [],
  });

  return { success: true, data: payment };
}

/** POS quick-sale = create + finalize in one offline step. */
export async function quickSaleOffline(
  input: CreateInvoiceInput
): Promise<OkEnvelope<InvoiceWithRelations>> {
  const created = await createInvoiceOffline(input);
  return finalizeInvoiceOffline(created.data.id);
}
