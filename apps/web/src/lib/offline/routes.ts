/**
 * Offline route table
 *
 * Maps API endpoint paths to the Dexie store that mirrors them. Only
 * operational modules appear here; anything NOT listed (accounting, HR,
 * reports, auth) stays network-only and throws when accessed offline.
 */

import type { OfflineDB } from './db';

export type RouteKind = 'list' | 'detail';

export interface OfflineRoute {
  /** Dexie table name on OfflineDB. */
  table: keyof OfflineDB & string;
  kind: RouteKind;
  /** Captured id for detail routes (group 1 of the regex). */
  pattern: RegExp;
}

/**
 * Ordered most-specific-first. `detail` patterns capture the id in group 1.
 * Paths are matched WITHOUT query string (params are passed separately).
 */
const ROUTES: OfflineRoute[] = [
  // Items
  // `grid` and `report` are literal sub-paths, not item ids — they must not be
  // served from the items store. /items/grid in particular returns merged
  // item + price + opening-stock rows that the Dexie mirror does not hold.
  { table: 'items', kind: 'detail', pattern: /^\/items\/(?!grid$|report$)([^/]+)$/ },
  { table: 'items', kind: 'list', pattern: /^\/items$/ },
  // Parties (customers/suppliers)
  { table: 'parties', kind: 'detail', pattern: /^\/parties\/([^/]+)$/ },
  { table: 'parties', kind: 'list', pattern: /^\/parties$/ },
  // Warehouses
  { table: 'warehouses', kind: 'detail', pattern: /^\/warehouses\/([^/]+)$/ },
  { table: 'warehouses', kind: 'list', pattern: /^\/warehouses$/ },
  // Invoices (sales + purchases)
  { table: 'invoices', kind: 'detail', pattern: /^\/invoices\/([^/]+)$/ },
  { table: 'invoices', kind: 'list', pattern: /^\/invoices$/ },
  // Payments
  { table: 'payments', kind: 'detail', pattern: /^\/payments\/([^/]+)$/ },
  { table: 'payments', kind: 'list', pattern: /^\/payments$/ },
  // Transfers
  { table: 'transfers', kind: 'detail', pattern: /^\/transfers\/([^/]+)$/ },
  { table: 'transfers', kind: 'list', pattern: /^\/transfers$/ },
  // POS locations
  { table: 'posLocations', kind: 'detail', pattern: /^\/pos\/([^/]+)$/ },
  { table: 'posLocations', kind: 'list', pattern: /^\/pos$/ },
];

export interface RouteMatch {
  route: OfflineRoute;
  id?: string;
}

/** Find the offline route for a path (no query string), or null. */
export function matchRoute(path: string): RouteMatch | null {
  for (const route of ROUTES) {
    const m = route.pattern.exec(path);
    if (m) {
      return { route, id: route.kind === 'detail' ? m[1] : undefined };
    }
  }
  return null;
}
