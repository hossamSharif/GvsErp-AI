/**
 * Expense Service
 *
 * Business logic for expense management including validation and reporting.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { ExpenseRepository } from '../repositories/expense.repository';
import type {
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
  private readonly tenantId: string;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.repo = new ExpenseRepository(supabase);
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
      category: input.category.trim(),
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
    if (input.category !== undefined) updates.category = input.category.trim();
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
    const deleted = await this.repo.delete(this.tenantId, id, false);
    if (!deleted) {
      throw new ExpenseError('Failed to delete expense', 'DELETE_FAILED', 500);
    }
  }

  async getCategories(): Promise<string[]> {
    return this.repo.getDistinctCategories(this.tenantId);
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
