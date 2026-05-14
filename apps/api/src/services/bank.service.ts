/**
 * Bank Service
 *
 * CRUD for bank/cash accounts (plan Phase 3). Each bank account owns a
 * ledger in the chart of accounts; creating a bank account creates (or
 * binds to) that ledger.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import type {
  BankAccount,
  BankAccountWithLedger,
  CreateBankAccountInput,
  UpdateBankAccountInput,
} from '@erp/shared';
import { AccountRepository } from '../repositories/account.repository';
import { AccountingService } from './accounting.service';

export class BankError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'BankError';
  }
}

/**
 * Search the asset accounts for the highest code matching `prefix` and
 * return the next sequential code. Used to auto-assign a code like 1111,
 * 1112, ... when the user creates a new bank account without picking a
 * pre-existing ledger.
 */
function nextCodeAfter(prefix: string, existingCodes: string[]): string {
  let maxSuffix = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const code of existingCodes) {
    const match = re.exec(code);
    if (match) {
      const suffix = parseInt(match[1], 10);
      if (suffix > maxSuffix) maxSuffix = suffix;
    }
  }
  const nextSuffix = (maxSuffix + 1).toString().padStart(prefix === '11' ? 2 : 1, '0');
  return `${prefix}${nextSuffix}`;
}

export class BankService {
  private supabase: SupabaseClient<Database>;
  private accountRepo: AccountRepository;
  private accountingService: AccountingService;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
    this.accountRepo = new AccountRepository(supabase);
    this.accountingService = new AccountingService(supabase);
  }

  /**
   * List active bank accounts for a tenant.
   */
  async listBankAccounts(tenantId: string): Promise<BankAccountWithLedger[]> {
    const { data, error } = await this.supabase
      .from('bank_accounts' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) throw error;
    const banks = ((data as unknown) as BankAccount[]) ?? [];

    // Hydrate ledger info (balance, code, name)
    const ledgerIds = banks.map((b) => b.ledger_account_id);
    if (ledgerIds.length === 0) return [];

    const { data: ledgers, error: lerr } = await this.supabase
      .from('accounts')
      .select('id, code, name, balance')
      .in('id', ledgerIds);
    if (lerr) throw lerr;

    const ledgerMap = new Map(
      (ledgers ?? []).map((l) => [l.id, { id: l.id, code: l.code, name: l.name, balance: Number(l.balance ?? 0) }])
    );

    return banks.map((b) => ({ ...b, ledger: ledgerMap.get(b.ledger_account_id) }));
  }

  async getBankAccount(tenantId: string, id: string): Promise<BankAccountWithLedger | null> {
    const { data, error } = await this.supabase
      .from('bank_accounts' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const bank = (data as unknown) as BankAccount;
    const ledger = await this.accountRepo.findById(tenantId, bank.ledger_account_id);
    return {
      ...bank,
      ledger: ledger
        ? { id: ledger.id, code: ledger.code, name: ledger.name, balance: Number(ledger.balance ?? 0) }
        : undefined,
    };
  }

  /**
   * Create a bank account. If `ledger_account_id` is provided, bind to it;
   * otherwise auto-create a ledger under Current Assets (parent code 1100)
   * with the next available 11xx code. The chart-of-accounts approach
   * mirrors Tally: every bank is a ledger.
   */
  async createBankAccount(
    tenantId: string,
    input: CreateBankAccountInput
  ): Promise<BankAccount> {
    let ledgerAccountId = input.ledger_account_id;

    if (!ledgerAccountId) {
      ledgerAccountId = await this.autoCreateLedgerForBank(tenantId, input.name);
    } else {
      const ledger = await this.accountRepo.findById(tenantId, ledgerAccountId);
      if (!ledger) {
        throw new BankError('Ledger account not found', 'LEDGER_NOT_FOUND', 404);
      }
      if (ledger.type !== 'asset') {
        throw new BankError(
          'Bank ledger must be an asset-type account',
          'LEDGER_WRONG_TYPE'
        );
      }
    }

    const { data, error } = await this.supabase
      .from('bank_accounts' as any)
      .insert({
        tenant_id: tenantId,
        name: input.name.trim(),
        account_number: input.account_number?.trim() || null,
        bank_name: input.bank_name?.trim() || null,
        ledger_account_id: ledgerAccountId,
        opening_balance: input.opening_balance ?? 0,
        currency: input.currency ?? 'USD',
        notes: input.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BankError(
          'A bank account is already bound to this ledger',
          'LEDGER_ALREADY_BOUND'
        );
      }
      throw error;
    }

    return (data as unknown) as BankAccount;
  }

  /**
   * Auto-provision a ledger under "Current Assets" for a new bank account.
   * The ledger code is the next free 11xx slot.
   */
  private async autoCreateLedgerForBank(tenantId: string, bankName: string): Promise<string> {
    // Look up existing 11xx asset codes
    const { data, error } = await this.supabase
      .from('accounts')
      .select('id, code')
      .eq('tenant_id', tenantId)
      .like('code', '11%');
    if (error) throw error;

    const existingCodes = (data ?? []).map((r) => r.code);
    const newCode = nextCodeAfter('11', existingCodes);

    // Find the Current Assets parent (code 1100) if present
    const parent = (data ?? []).find((r) => r.code === '1100');

    const account = await this.accountRepo.create(tenantId, {
      code: newCode,
      name: bankName,
      type: 'asset',
      parent_id: parent?.id,
    });
    return account.id;
  }

  async updateBankAccount(
    tenantId: string,
    id: string,
    input: UpdateBankAccountInput
  ): Promise<BankAccount | null> {
    const existing = await this.getBankAccount(tenantId, id);
    if (!existing) return null;

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.account_number !== undefined) updates.account_number = input.account_number?.trim() ?? null;
    if (input.bank_name !== undefined) updates.bank_name = input.bank_name?.trim() ?? null;
    if (input.notes !== undefined) updates.notes = input.notes?.trim() ?? null;
    if (input.is_active !== undefined) updates.is_active = input.is_active;

    if (Object.keys(updates).length === 0) {
      return existing;
    }

    const { data, error } = await this.supabase
      .from('bank_accounts' as any)
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Keep ledger.name in sync with bank.name (Tally renames the linked
    // ledger when the bank is renamed).
    if (input.name !== undefined) {
      await this.accountRepo.update(tenantId, existing.ledger_account_id, {
        name: input.name.trim(),
      });
    }

    return (data as unknown) as BankAccount;
  }

  /**
   * Deactivate a bank account. We never hard-delete because journal entries
   * may reference its ledger (and payments may reference the bank itself).
   */
  async deactivateBankAccount(tenantId: string, id: string): Promise<boolean> {
    const updated = await this.updateBankAccount(tenantId, id, { is_active: false });
    return updated !== null;
  }

  /**
   * Bank statement: all journal lines hitting this bank's ledger in a
   * date range, with running balance. Tally's "Cash/Bank Book".
   */
  async getBankStatement(
    tenantId: string,
    bankId: string,
    startDate: string,
    endDate: string
  ) {
    const bank = await this.getBankAccount(tenantId, bankId);
    if (!bank) {
      throw new BankError('Bank account not found', 'BANK_NOT_FOUND', 404);
    }
    return this.accountingService.generateGeneralLedger(
      tenantId,
      bank.ledger_account_id,
      startDate,
      endDate
    );
  }
}
