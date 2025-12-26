/**
 * Account Repository
 *
 * Manages chart of accounts for the accounting module.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';
import type { Account, AccountType } from '@erp-saas/shared';

type AccountRow = Database['public']['Tables']['accounts']['Row'];
type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
type AccountUpdate = Database['public']['Tables']['accounts']['Update'];

export interface AccountQueryOptions extends QueryOptions {
  type?: AccountType;
  parent_id?: string;
  search?: string;
}

export class AccountRepository extends BaseRepository<
  'accounts',
  AccountRow,
  AccountInsert,
  AccountUpdate
> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'accounts');
  }

  protected hasIsActiveColumn(): boolean {
    return true;
  }

  /**
   * Find all accounts with optional filters
   */
  async findAll(options: AccountQueryOptions): Promise<QueryResult<Account>> {
    const {
      tenantId,
      page = 1,
      limit = 50,
      sort_by = 'code',
      sort_order = 'asc',
      includeInactive = false,
      type,
      parent_id,
      search,
    } = options;

    const offset = (page - 1) * limit;

    // Build query
    let query = this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (parent_id !== undefined) {
      if (parent_id === null || parent_id === '') {
        query = query.is('parent_id', null);
      } else {
        query = query.eq('parent_id', parent_id);
      }
    }

    if (search) {
      query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);
    }

    // Apply sorting and pagination
    query = query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data || []) as Account[],
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find account by code
   */
  async findByCode(tenantId: string, code: string): Promise<Account | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('code', code)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as Account;
  }

  /**
   * Get account tree (hierarchical structure)
   */
  async getAccountTree(tenantId: string, type?: AccountType): Promise<Account[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return this.buildTree(data as Account[]);
  }

  /**
   * Get child accounts
   */
  async getChildren(tenantId: string, parentId: string): Promise<Account[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('parent_id', parentId)
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as Account[];
  }

  /**
   * Check if account has children
   */
  async hasChildren(tenantId: string, accountId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('parent_id', accountId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    return (count || 0) > 0;
  }

  /**
   * Get root accounts (no parent)
   */
  async getRootAccounts(tenantId: string, type?: AccountType): Promise<Account[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .is('parent_id', null)
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data || []) as Account[];
  }

  /**
   * Build hierarchical tree structure
   */
  private buildTree(accounts: Account[]): Account[] {
    const accountMap = new Map<string, Account>();
    const rootAccounts: Account[] = [];

    // Create map of all accounts
    accounts.forEach((account) => {
      accountMap.set(account.id, { ...account, children: [] as Account[] });
    });

    // Build tree structure
    accounts.forEach((account) => {
      const node = accountMap.get(account.id);
      if (!node) return;

      if (account.parent_id) {
        const parent = accountMap.get(account.parent_id);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(node);
        }
      } else {
        rootAccounts.push(node);
      }
    });

    return rootAccounts;
  }

  /**
   * Update account balance (called by journal entry posting)
   */
  async updateBalance(
    tenantId: string,
    accountId: string,
    amount: number
  ): Promise<Account | null> {
    const account = await this.findById(tenantId, accountId);
    if (!account) return null;

    const newBalance = (account.balance || 0) + amount;

    return this.update(tenantId, accountId, { balance: newBalance });
  }
}
