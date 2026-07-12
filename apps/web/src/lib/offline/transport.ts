/**
 * Offline transport
 *
 * Sits behind `api-client.ts`. On a successful online GET it mirrors the
 * response into Dexie (read-through cache). When offline it reconstructs the
 * same `{ success, data, meta }` envelope from Dexie so the data hooks stay
 * oblivious to connectivity.
 *
 * Phase 1 covers reads. Offline writes (drafts, finalize) are layered on in
 * later phases via the outbox.
 */

import { getDB, inventoryKey, type CachedRecord } from './db';
import { matchRoute } from './routes';
import type { CreateInvoiceInput } from '@erp/shared';

/** Standard list envelope produced by the API. */
interface ListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  /** Summed `total` across all matching rows (invoices lists only). */
  totalAmount?: number;
}

/** Thrown when an offline request hits an endpoint with no offline support. */
export class OfflineUnavailableError extends Error {
  public readonly code = 'OFFLINE_UNAVAILABLE';
  constructor(message = 'This action requires an internet connection') {
    super(message);
    this.name = 'OfflineUnavailableError';
  }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/** Strip query string and normalise an endpoint to a bare path. */
function toPath(endpoint: string): string {
  const q = endpoint.indexOf('?');
  return q === -1 ? endpoint : endpoint.slice(0, q);
}

function nowIso(): string {
  return new Date().toISOString();
}

function withSyncedAt<T extends Record<string, unknown>>(record: T): CachedRecord {
  return { ...(record as object), _syncedAt: nowIso() } as CachedRecord;
}

/**
 * Best-effort mirror of a successful GET response into Dexie. Never throws —
 * caching must not break the online path.
 */
export async function cacheGetResponse(endpoint: string, response: unknown): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    const match = matchRoute(toPath(endpoint));
    if (!match) return;
    const env = response as { data?: unknown };
    if (!env || env.data === undefined || env.data === null) return;

    const db = getDB();
    const tableName = match.route.table;

    if (Array.isArray(env.data)) {
      const rows = (env.data as Array<Record<string, unknown>>)
        .filter((r) => typeof r?.id === 'string')
        .map(withSyncedAt);
      if (rows.length) await db.table(tableName).bulkPut(rows);
      await mirrorInventoryFrom(rows, tableName);
    } else if (typeof (env.data as Record<string, unknown>).id === 'string') {
      const row = withSyncedAt(env.data as Record<string, unknown>);
      await db.table(tableName).put(row);
      await mirrorInventoryFrom([row], tableName);
    }
  } catch (err) {
    // Swallow — read-through caching is best-effort.
    console.warn('[offline] cacheGetResponse failed', err);
  }
}

/**
 * If a warehouse detail/list carries nested inventory, project it into the
 * composite-keyed inventory store the finalize engine reads. Defensive: shapes
 * vary, so guard everything.
 */
async function mirrorInventoryFrom(rows: CachedRecord[], tableName: string): Promise<void> {
  if (tableName !== 'warehouses' && tableName !== 'items') return;
  const db = getDB();
  const invRows: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const inv = (row as Record<string, unknown>).inventory;
    if (Array.isArray(inv)) {
      for (const i of inv as Array<Record<string, unknown>>) {
        const warehouseId = String(i.warehouseId ?? row.id);
        const itemId = String(i.itemId ?? i.id ?? '');
        if (!itemId) continue;
        invRows.push({
          ...i,
          whItem: inventoryKey(warehouseId, itemId),
          warehouseId,
          itemId,
          quantity: Number(i.quantity ?? 0),
          _syncedAt: nowIso(),
        });
      }
    }
  }
  if (invRows.length) await db.inventory.bulkPut(invRows as never);
}

/**
 * Serve a GET from Dexie when offline. Returns the reconstructed envelope or
 * throws OfflineUnavailableError if the endpoint has no offline mapping.
 */
export async function readOffline<T>(
  endpoint: string,
  params?: Record<string, unknown>
): Promise<T> {
  const match = matchRoute(toPath(endpoint));
  if (!match) {
    throw new OfflineUnavailableError();
  }
  const db = getDB();
  const table = db.table(match.route.table);

  if (match.route.kind === 'detail') {
    const record = await table.get(match.id!);
    if (!record) throw new OfflineUnavailableError('Not available offline');
    return { success: true, data: record } as T;
  }

  // List: return all cached rows with a simple client-side page slice so the
  // envelope shape matches the server. Exact server-side filtering/sorting is
  // re-applied on the next online fetch.
  let rows = (await table.toArray()) as CachedRecord[];
  rows = applyListFilters(rows, match.route.table, params);

  const page = Number(params?.page ?? 1) || 1;
  const limit = Number(params?.limit ?? 50) || 50;
  const total = rows.length;
  const start = (page - 1) * limit;
  const pageRows = rows.slice(start, start + limit);

  const meta: ListMeta = {
    page,
    limit,
    total,
    total_pages: Math.max(1, Math.ceil(total / limit)),
  };
  // Filter-aware grand total for invoices, mirroring the server's meta.totalAmount
  // so the records pages show a consistent total online and offline.
  if (match.route.table === 'invoices') {
    meta.totalAmount = rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  }
  return { success: true, data: pageRows, meta } as T;
}

/**
 * Route an offline write to the engine. Returns the same envelope shape the
 * corresponding online endpoint returns. Throws OfflineUnavailableError for any
 * write without an offline handler (e.g. accounting, HR).
 */
export async function writeOffline<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  body: unknown
): Promise<T> {
  const path = toPath(endpoint);
  const engine = await import('./engine');

  if (method === 'POST' && /^\/invoices$/.test(path)) {
    return (await engine.createInvoiceOffline(body as CreateInvoiceInput)) as T;
  }

  let m = /^\/invoices\/([^/]+)$/.exec(path);
  if (m && method === 'PUT') {
    return (await engine.updateInvoiceOffline(m[1], body as never)) as T;
  }

  m = /^\/invoices\/([^/]+)\/finalize$/.exec(path);
  if (m && method === 'POST') {
    return (await engine.finalizeInvoiceOffline(m[1])) as T;
  }

  if (method === 'POST' && /^\/payments$/.test(path)) {
    return (await engine.createPaymentOffline(body as never)) as T;
  }

  m = /^\/pos\/([^/]+)\/sale$/.exec(path);
  if (m && method === 'POST') {
    return (await posQuickSaleOffline(m[1], body as Record<string, unknown>)) as T;
  }

  throw new OfflineUnavailableError();
}

/** Map a POS quick-sale request to the invoice engine and finalize it. */
async function posQuickSaleOffline(
  posLocationId: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const db = getDB();
  const pos = (await db.posLocations.get(posLocationId)) as CachedRecord | undefined;
  const warehouseId = pos ? String(pos.warehouseId ?? '') : '';
  if (!warehouseId) {
    throw new OfflineUnavailableError('POS terminal not available offline');
  }

  const rawItems = Array.isArray(body.items) ? (body.items as Array<Record<string, unknown>>) : [];
  const input: CreateInvoiceInput = {
    type: 'sale',
    warehouseId,
    partyId: (body.party_id as string) ?? null,
    discountAmount: Number(body.discount_amount ?? 0),
    notes: (body.notes as string) ?? null,
    items: rawItems.map((i) => ({
      itemId: String(i.item_id),
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      discountPercent: Number(i.discount_percent ?? 0),
    })),
  };

  const engine = await import('./engine');
  const result = await engine.quickSaleOffline(input);
  const inv = result.data;
  return {
    success: true,
    data: {
      invoice_id: inv.id,
      invoice_number: inv.invoiceNumber,
      total: inv.total,
    },
  };
}

/** Minimal, well-known filters so offline lists feel right. */
function applyListFilters(
  rows: CachedRecord[],
  table: string,
  params?: Record<string, unknown>
): CachedRecord[] {
  if (!params) return rows;
  let out = rows;

  const search = typeof params.search === 'string' ? params.search.toLowerCase() : '';
  if (search) {
    out = out.filter((r) => {
      const name = String(r.name ?? '').toLowerCase();
      const sku = String(r.sku ?? '').toLowerCase();
      const number = String(r.invoiceNumber ?? r.transferNumber ?? '').toLowerCase();
      return name.includes(search) || sku.includes(search) || number.includes(search);
    });
  }

  // Invoices list is filtered by `type` (sale|purchase) in the UI, plus the
  // records-page filters: status, creator, and date range. Cached invoice rows
  // carry camelCase fields (createdBy/createdAt/status) from the API mapper.
  if (table === 'invoices') {
    if (typeof params.type === 'string') {
      out = out.filter((r) => r.type === params.type);
    }
    if (typeof params.status === 'string') {
      out = out.filter((r) => r.status === params.status);
    }
    if (typeof params.createdBy === 'string') {
      out = out.filter((r) => r.createdBy === params.createdBy);
    }
    if (typeof params.dateFrom === 'string') {
      const from = `${params.dateFrom}T00:00:00Z`;
      out = out.filter((r) => String(r.createdAt ?? '') >= from);
    }
    if (typeof params.dateTo === 'string') {
      const to = `${params.dateTo}T23:59:59Z`;
      out = out.filter((r) => String(r.createdAt ?? '') <= to);
    }
  }
  // Parties list is filtered by `type` (customer|supplier).
  if (table === 'parties' && typeof params.type === 'string') {
    out = out.filter((r) => r.type === params.type);
  }
  if (typeof params.isActive === 'boolean') {
    out = out.filter((r) => r.isActive === undefined || r.isActive === params.isActive);
  }
  return out;
}
