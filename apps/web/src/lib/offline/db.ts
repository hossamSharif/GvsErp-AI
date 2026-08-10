/**
 * Offline IndexedDB store (Dexie)
 *
 * Canonical local mirror of operational data for offline-first use. The HTTP
 * transport (`api-client.ts`) reads through this store when offline and writes
 * API responses into it when online. Writes made offline live in `outbox` and
 * replay on reconnect (see `lib/offline/sync.ts`).
 *
 * Scope: operational modules only (items, parties, invoices, payments,
 * warehouses, inventory, transfers, POS). Accounting and HR are intentionally
 * NOT mirrored — they stay online-only.
 *
 * One database per browser; it is wiped/reinitialised on tenant switch
 * (single-device-per-tenant model, so no cross-device merge is needed).
 */

import Dexie, { type Table } from 'dexie';

/** A cached API record. We store whatever the API returns, keyed by `id`. */
export interface CachedRecord {
  id: string;
  /** ISO timestamp of when this row was last written locally. */
  _syncedAt?: string;
  // The remaining fields are the API record shape (camelCase domain type).
  [key: string]: unknown;
}

/**
 * Inventory rows are keyed by a composite `whItem` (not `id`) for O(1)
 * warehouse+item lookups during offline finalize.
 */
export interface CachedInventory {
  /** `${warehouseId}:${itemId}` — the primary key. */
  whItem: string;
  warehouseId: string;
  itemId: string;
  quantity: number;
  /** Server inventory row id, when known. */
  id?: string;
  _syncedAt?: string;
  [key: string]: unknown;
}

/** Kinds of queued offline mutation, drained in dependency order. */
export type OutboxType =
  | 'invoice.create'
  | 'invoice.finalize'
  | 'invoice.return'
  | 'payment.create'
  | 'transfer.create'
  | 'transfer.execute';

export type OutboxStatus = 'pending' | 'inflight' | 'synced' | 'failed';

export interface OutboxEntry {
  /** Local UUID for this queue entry. */
  id: string;
  /** Unique idempotency key sent to the server to dedupe replays. */
  idempotencyKey: string;
  /** Monotonic drain order (assigned max+1 at enqueue). */
  seq?: number;
  type: OutboxType;
  /** Local id of the entity this mutation concerns. */
  entityLocalId: string;
  /** Other outbox entry ids that must sync before this one. */
  dependsOn: string[];
  /** Endpoint + payload to replay. */
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: unknown;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  /**
   * The server rejected this permanently (a 4xx that retrying cannot fix, e.g.
   * a deleted item or an already-finalized invoice). Auto-retry stops; the user
   * must retry or discard it explicitly from the pending-changes dialog.
   */
  blocked?: boolean;
  /** HTTP status / API error code from the last failed replay, for display. */
  lastStatus?: number;
  lastCode?: string;
  /** Outbox entry id this one is deferred behind (dependency not yet synced). */
  waitingOn?: string;
  /** ISO of the last status transition — powers "3 tries, last attempt 2h ago". */
  updatedAt?: string;
}

/** Per-table delta cursors + global sync state. */
export interface SyncMetaEntry {
  /** e.g. 'invoices', 'items', or '__global__'. */
  key: string;
  /** ISO cursor for incremental pulls (updatedSince). */
  updatedSince?: string;
  lastFullSyncAt?: string;
  tenantId?: string;
  deviceId?: string;
  schemaVersion?: number;
}

/** Maps a client-generated local id / temp number to the server's canonical one. */
export interface IdMapEntry {
  /** Local UUID or temp number (e.g. `OFF-1A2B3C4D`). */
  localKey: string;
  serverId?: string;
  serverNumber?: string;
  entity: string;
  mappedAt: string;
}

/** Local offline-unlock identity + PIN (Phase 5). */
export interface AuthLocalEntry {
  key: 'current';
  userId: string;
  tenantId: string;
  email: string;
  /** Snapshot of the CurrentUser payload + permissions. */
  currentUser: unknown;
  /** PBKDF2 hash of the PIN (never the PIN itself). */
  pinHash?: string;
  pinSalt?: string;
  pinIterations?: number;
  failedAttempts?: number;
  lockedUntil?: string;
  updatedAt: string;
}

export class OfflineDB extends Dexie {
  // Master data (read cache)
  items!: Table<CachedRecord, string>;
  categories!: Table<CachedRecord, string>;
  itemPrices!: Table<CachedRecord, string>;
  parties!: Table<CachedRecord, string>;
  warehouses!: Table<CachedRecord, string>;
  inventory!: Table<CachedInventory, string>;
  posLocations!: Table<CachedRecord, string>;
  settings!: Table<CachedRecord, string>;

  // Transactional data (read cache + local writes)
  invoices!: Table<CachedRecord, string>;
  invoiceItems!: Table<CachedRecord, string>;
  payments!: Table<CachedRecord, string>;
  transfers!: Table<CachedRecord, string>;

  // Engine stores
  outbox!: Table<OutboxEntry, string>;
  syncMeta!: Table<SyncMetaEntry, string>;
  idMap!: Table<IdMapEntry, string>;
  authLocal!: Table<AuthLocalEntry, string>;

  constructor() {
    super('erp-offline');
    this.version(1).stores({
      // `&id` = unique primary key; secondary indexes after the comma.
      items: '&id, sku, barcode, categoryId, name',
      categories: '&id, name, parentId',
      itemPrices: '&id, itemId',
      parties: '&id, type, name',
      warehouses: '&id, name',
      inventory: '&whItem, warehouseId, itemId',
      posLocations: '&id, name',
      settings: '&id',

      invoices: '&id, type, status, partyId, warehouseId, invoiceNumber, createdAt',
      invoiceItems: '&id, invoiceId, itemId',
      payments: '&id, partyId, type, invoiceId, createdAt',
      transfers: '&id, status, transferNumber, createdAt',

      // `seq` is a plain index (assigned max+1 at enqueue) — Dexie only allows
      // auto-increment (++) on the primary key, and the PK is the UUID `id`.
      outbox: '&id, seq, status, entityLocalId, idempotencyKey',
      syncMeta: '&key',
      idMap: '&localKey, serverId, entity',
      authLocal: '&key',
    });
  }
}

let _db: OfflineDB | null = null;

/** Lazily construct the DB (only in the browser; Dexie needs IndexedDB). */
export function getDB(): OfflineDB {
  if (typeof window === 'undefined') {
    throw new Error('OfflineDB is only available in the browser');
  }
  if (!_db) {
    _db = new OfflineDB();
  }
  return _db;
}

/** Compose the composite inventory key. */
export function inventoryKey(warehouseId: string, itemId: string): string {
  return `${warehouseId}:${itemId}`;
}

/** Wipe all local data — used on tenant switch / sign-out. */
export async function wipeOfflineDB(): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = getDB();
  await db.delete();
  _db = null;
}
