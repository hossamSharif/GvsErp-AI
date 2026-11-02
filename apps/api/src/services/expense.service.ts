/**
 * Expense Service
 *
 * Business logic for expense management including validation and reporting.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { ExpenseRepository } from '../repositories/expense.repository';
import { ExpenseCategoryRepository } from '../repositories/expense-category.repository';
import { AccountingService } from './accounting.service';
import { EXPENSE_CATEGORY_VALUES } from '@erp/shared';
import type {
  ExpenseCategoryRecord,
  ExpenseCategoryQueryParams,
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
  Expense,
  ExpenseWithCreator,
  ExpenseQueryParams,
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseReportParams,
  ExpenseReportResponse,
  ExpenseReportEntry,
  ExpenseReportSummary,
} from '@erp/shared';
import type { QueryResult } from '../repositories/base.repository';

export class ExpenseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ExpenseError';
  }
}

export class ExpenseService {
  private readonly repo: ExpenseRepository;
  private readonly categoryRepo: ExpenseCategoryRepository;
  private readonly accountingService: AccountingService;
  private readonly tenantId: string;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.repo = new ExpenseRepository(supabase);
    this.categoryRepo = new ExpenseCategoryRepository(supabase);
    this.accountingService = new AccountingService(supabase);
    this.tenantId = tenantId;
  }

  async getExpenses(params: ExpenseQueryParams): Promise<QueryResult<ExpenseWithCreator>> {
    return this.repo.findAllWithFilters({
      tenantId: this.tenantId,
      page: params.page,
      limit: params.limit,
      sort_by: params.sortBy,
      sort_order: params.sortDir,
      category: params.category,
      paymentMethod: params.paymentMethod,
      search: params.search,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      minAmount: params.minAmount,
      maxAmount: params.maxAmount,
    });
  }

  async getExpense(id: string): Promise<ExpenseWithCreator> {
    const expense = await this.repo.findByIdWithCreator(this.tenantId, id);
    if (!expense) {
      throw new ExpenseError('Expense not found', 'EXPENSE_NOT_FOUND', 404);
    }
    return expense;
  }

  async createExpense(input: CreateExpenseInput, userId?: string): Promise<ExpenseWithCreator> {
    const data = {
      category: await this.resolveCategoryName(input.category),
      amount: input.amount,
      currency: input.currency || 'USD',
      exchange_rate: input.exchangeRate ?? 1,
      expense_date: input.expenseDate || new Date().toISOString().split('T')[0],
      description: input.description?.trim() || null,
      reference: input.reference?.trim() || null,
      payment_method: input.paymentMethod?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: userId || null,
    };

    const created = await this.repo.create(this.tenantId, data);

    // Auto-post the corresponding journal entry. Silently no-ops when
    // accounting is disabled for the tenant.
    if (await this.accountingService.isEnabled(this.tenantId)) {
      try {
        await this.accountingService.generateJournalEntryFromExpense(
          this.tenantId,
          userId ?? null,
          created.id,
          {
            amount: Number(created.amount),
            category_name: created.category,
          },
          data.expense_date
        );
      } catch (error) {
        console.error(
          `[expense] Failed to post accounting entry for expense ${created.id}:`,
          error
        );
      }
    }

    const withCreator = await this.repo.findByIdWithCreator(this.tenantId, created.id);
    if (!withCreator) {
      throw new ExpenseError('Failed to retrieve created expense', 'CREATE_FAILED', 500);
    }
    return withCreator;
  }

  async updateExpense(id: string, input: UpdateExpenseInput): Promise<Expense> {
    const existing = await this.repo.findById(this.tenantId, id);
    if (!existing) {
      throw new ExpenseError('Expense not found', 'EXPENSE_NOT_FOUND', 404);
    }

    const updates: Record<string, unknown> = {};
    if (input.category !== undefined) {
      updates.category = await this.resolveCategoryName(input.category, existing.category);
    }
    if (input.amount !== undefined) updates.amount = input.amount;
    if (input.currency !== undefined) updates.currency = input.currency;
    if (input.exchangeRate !== undefined) updates.exchange_rate = input.exchangeRate;
    if (input.expenseDate !== undefined) updates.expense_date = input.expenseDate;
    if (input.description !== undefined) {
      updates.description = input.description?.trim() || null;
    }
    if (input.reference !== undefined) {
      updates.reference = input.reference?.trim() || null;
    }
    if (input.paymentMethod !== undefined) {
      updates.payment_method = input.paymentMethod?.trim() || null;
    }
    if (input.notes !== undefined) {
      updates.notes = input.notes?.trim() || null;
    }

    const row = await this.repo.update(this.tenantId, id, updates as any);
    if (!row) {
      throw new ExpenseError('Failed to update expense', 'UPDATE_FAILED', 500);
    }
    return this.repo.mapRow(row);
  }

  async deleteExpense(id: string): Promise<void> {
    const existing = await this.repo.findById(this.tenantId, id);
    if (!existing) {
      throw new ExpenseError('Expense not found', 'EXPENSE_NOT_FOUND', 404);
    }

    // Reverse the auto-posted journal entry before deletion.
    if (await this.accountingService.isEnabled(this.tenantId)) {
      try {
        await this.accountingService.reverseEntry(
          this.tenantId,
          null,
          'expense',
          id,
          'Expense deleted'
        );
      } catch (error) {
        console.error(
          `[expense] Failed to reverse accounting entry for expense ${id}:`,
          error
        );
      }
    }

    const deleted = await this.repo.delete(this.tenantId, id, false);
    if (!deleted) {
      throw new ExpenseError('Failed to delete expense', 'DELETE_FAILED', 500);
    }
  }

  // ==========================================================================
  // CATEGORIES
  // ==========================================================================

  async getCategories(params: ExpenseCategoryQueryParams = {}): Promise<ExpenseCategoryRecord[]> {
    await this.ensureDefaultCategories();
    const rows = await this.categoryRepo.list(this.tenantId, params.includeInactive ?? false);
    const usage = await this.categoryRepo.countUsage(this.tenantId);
    return rows.map((row) => this.categoryRepo.mapRow(row, usage.get(row.name) ?? 0));
  }

  async createCategory(input: CreateExpenseCategoryInput): Promise<ExpenseCategoryRecord> {
    const name = input.name.trim();
    if (await this.categoryRepo.findByName(this.tenantId, name)) {
      throw new ExpenseError('A category with this name already exists', 'CATEGORY_EXISTS', 409);
    }

    const created = await this.categoryRepo.create(this.tenantId, { name });
    return this.categoryRepo.mapRow(created);
  }

  async updateCategory(id: string, input: UpdateExpenseCategoryInput): Promise<ExpenseCategoryRecord> {
    let row = await this.categoryRepo.findById(this.tenantId, id);
    if (!row) {
      throw new ExpenseError('Category not found', 'CATEGORY_NOT_FOUND', 404);
    }

    const name = input.name?.trim();
    if (name !== undefined && name !== row.name) {
      const duplicate = await this.categoryRepo.findByName(this.tenantId, name);
      if (duplicate && duplicate.id !== id) {
        throw new ExpenseError('A category with this name already exists', 'CATEGORY_EXISTS', 409);
      }
      row = await this.categoryRepo.rename(this.tenantId, id, name);
      if (!row) {
        throw new ExpenseError('Failed to rename category', 'UPDATE_FAILED', 500);
      }
    }

    if (input.isActive !== undefined && input.isActive !== row.is_active) {
      row = await this.categoryRepo.update(this.tenantId, id, { is_active: input.isActive });
      if (!row) {
        throw new ExpenseError('Failed to update category', 'UPDATE_FAILED', 500);
      }
    }

    const expenseCount = await this.categoryRepo.countUsageForName(this.tenantId, row.name);
    return this.categoryRepo.mapRow(row, expenseCount);
  }

  async deleteCategory(id: string): Promise<void> {
    const row = await this.categoryRepo.findById(this.tenantId, id);
    if (!row) {
      throw new ExpenseError('Category not found', 'CATEGORY_NOT_FOUND', 404);
    }

    if ((await this.categoryRepo.countUsageForName(this.tenantId, row.name)) > 0) {
      throw new ExpenseError(
        'Category is used by existing expenses; deactivate it instead',
        'CATEGORY_IN_USE',
        409
      );
    }

    await this.categoryRepo.delete(this.tenantId, id, false);
  }

  /**
   * Tenants created after migration 040 start with the built-in defaults.
   * Returns true when it seeded.
   */
  private async ensureDefaultCategories(): Promise<boolean> {
    if ((await this.categoryRepo.count(this.tenantId, true)) > 0) return false;
    await this.categoryRepo.seed(this.tenantId, EXPENSE_CATEGORY_VALUES);
    return true;
  }

  /**
   * Resolve a category name to its stored spelling. New expenses need an
   * active category; an edit may keep the expense's current (inactive) one.
   */
  private async resolveCategoryName(name: string, currentName?: string): Promise<string> {
    const trimmed = name.trim();
    if (currentName !== undefined && trimmed === currentName) return currentName;

    let row = await this.categoryRepo.findByName(this.tenantId, trimmed);
    if (!row && (await this.ensureDefaultCategories())) {
      row = await this.categoryRepo.findByName(this.tenantId, trimmed);
    }
    if (!row) {
      throw new ExpenseError('Unknown expense category', 'CATEGORY_NOT_FOUND', 400);
    }
    if (!row.is_active) {
      throw new ExpenseError('Expense category is inactive', 'CATEGORY_INACTIVE', 400);
    }
    return row.name;
  }

  async getReport(params: ExpenseReportParams): Promise<ExpenseReportResponse> {
    const result = await this.getExpenses({
      category: params.category,
      paymentMethod: params.paymentMethod,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: 1,
      limit: 10000,
      sortBy: 'expenseDate',
      sortDir: 'desc',
    });

    const entries: ExpenseReportEntry[] = result.data.map((e) => ({
      id: e.id,
      category: e.category,
      amount: e.amount,
      currency: e.currency,
      expenseDate: e.expenseDate,
      description: e.description,
      reference: e.reference,
      paymentMethod: e.paymentMethod,
    }));

    let summary: ExpenseReportSummary | undefined;
    if (params.includeSummary !== false) {
      const byCategory: Record<string, { count: number; total: number }> = {};
      const byMethod: Record<string, { count: number; total: number }> = {};
      let totalAmount = 0;

      for (const entry of entries) {
        const cat = entry.category || 'other';
        const method = entry.paymentMethod || 'unspecified';

        if (!byCategory[cat]) byCategory[cat] = { count: 0, total: 0 };
        byCategory[cat].count += 1;
        byCategory[cat].total += entry.amount;

        if (!byMethod[method]) byMethod[method] = { count: 0, total: 0 };
        byMethod[method].count += 1;
        byMethod[method].total += entry.amount;

        totalAmount += entry.amount;
      }

      summary = {
        totalCount: entries.length,
        totalAmount,
        byCategory,
        byMethod,
      };
    }

    return {
      entries,
      summary,
      generatedAt: new Date().toISOString(),
    };
  }
}
