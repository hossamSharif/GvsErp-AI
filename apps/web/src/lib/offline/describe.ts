/**
 * Outbox → human description
 *
 * The outbox stores raw replay instructions (`POST /invoices` + a JSON payload).
 * That is meaningless to the person looking at a stuck badge, who needs to know
 * *which invoice* and *how much*. This resolves each entry against the local
 * mirror (falling back to the payload when the record was already replaced) so
 * the pending-changes dialog can say "Sale invoice OFF-1A2B · Ahmed Trading ·
 * $1,240.00" instead of a URL.
 */

import { getDB, type OutboxEntry, type OutboxType } from './db';

/** Display state, derived from status + flags rather than stored separately. */
export type PendingChangeState = 'queued' | 'waiting' | 'syncing' | 'failed' | 'blocked';

export interface PendingChangeView {
  id: string;
  type: OutboxType;
  /** Key under the `offline.kind` i18n namespace. */
  kindKey: string;
  state: PendingChangeState;
  /** Temporary document number (e.g. `OFF-1A2B3C4D`), when the entity has one. */
  docNumber?: string;
  partyName?: string;
  amount?: number;
  currency?: string;
  createdAt: string;
  updatedAt?: string;
  attempts: number;
  errorText?: string;
  lastStatus?: number;
  /** Document number (or short id) of the entry this one is deferred behind. */
  waitingOnLabel?: string;
  // Raw replay details, shown under "technical details".
  method: string;
  endpoint: string;
  payload: unknown;
  idempotencyKey: string;
}

const KIND_KEYS: Record<OutboxType, string> = {
  'invoice.create': 'invoiceCreate',
  'invoice.finalize': 'invoiceFinalize',
  'invoice.return': 'invoiceReturn',
  'payment.create': 'paymentCreate',
  'transfer.create': 'transferCreate',
  'transfer.execute': 'transferExecute',
};

function stateOf(entry: OutboxEntry): PendingChangeState {
  if (entry.blocked) return 'blocked';
  if (entry.status === 'inflight') return 'syncing';
  if (entry.status === 'failed') return 'failed';
  if (entry.waitingOn) return 'waiting';
  return 'queued';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function num(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Short, recognisable label for an entry — used for "waiting for …". */
function shortLabel(view: Pick<PendingChangeView, 'docNumber' | 'id'>): string {
  return view.docNumber ?? view.id.slice(0, 8);
}

async function describeOne(entry: OutboxEntry): Promise<PendingChangeView> {
  const db = getDB();
  const payload = asRecord(entry.payload);

  const view: PendingChangeView = {
    id: entry.id,
    type: entry.type,
    kindKey: KIND_KEYS[entry.type] ?? 'unknown',
    state: stateOf(entry),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    attempts: entry.attempts,
    errorText: entry.lastError,
    lastStatus: entry.lastStatus,
    method: entry.method,
    endpoint: entry.endpoint,
    payload: entry.payload,
    idempotencyKey: entry.idempotencyKey,
  };

  if (entry.type === 'payment.create') {
    const record = asRecord(await db.payments.get(entry.entityLocalId));
    view.amount = num(record.amount) ?? num(payload.amount);
    view.currency = str(record.currency) ?? str(payload.currency);
    const partyId = str(record.partyId) ?? str(payload.partyId);
    if (partyId) view.partyName = str(asRecord(await db.parties.get(partyId)).name);
    return view;
  }

  if (entry.type === 'transfer.create' || entry.type === 'transfer.execute') {
    const record = asRecord(await db.transfers.get(entry.entityLocalId));
    view.docNumber = str(record.transferNumber);
    return view;
  }

  // Invoice create / finalize / return.
  const record = asRecord(await db.invoices.get(entry.entityLocalId));
  view.docNumber = str(record.invoiceNumber);
  view.amount = num(record.total);
  view.currency = str(record.currency) ?? str(payload.currency);
  view.partyName =
    str(asRecord(record.party).name) ??
    (str(record.partyId) ?? str(payload.partyId)
      ? str(asRecord(await db.parties.get((str(record.partyId) ?? str(payload.partyId))!)).name)
      : undefined);
  return view;
}

/**
 * Describe every queued mutation, in the exact order it will hit the server.
 * `waitingOn` ids are resolved to the readable label of the entry they point at.
 */
export async function describePendingChanges(
  entries: OutboxEntry[]
): Promise<PendingChangeView[]> {
  const views = await Promise.all(entries.map(describeOne));
  const byId = new Map(views.map((v) => [v.id, v]));
  for (const view of views) {
    const waitingOn = entries.find((e) => e.id === view.id)?.waitingOn;
    const target = waitingOn ? byId.get(waitingOn) : undefined;
    if (target) view.waitingOnLabel = shortLabel(target);
  }
  return views;
}
