/**
 * @erp/database - Database client and types
 */

export {
  createServiceClient,
  createServerClient,
  createBrowserClient,
  createClient,
} from './client';

export type {
  Database,
  SupabaseClient,
  TableName,
  Row,
  InsertRow,
  UpdateRow,
} from './client';

export type { Json } from './types/database.types';
