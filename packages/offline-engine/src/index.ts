/**
 * @erp/offline-engine
 *
 * Pure, deterministic finance + identifier helpers shared by the API
 * (`apps/api`) and the web client (`apps/web`). Having one implementation
 * guarantees that a document priced/finalized offline matches the same
 * document processed on the server.
 */

export * from './types';
export * from './calculations';
export * from './identifiers';
