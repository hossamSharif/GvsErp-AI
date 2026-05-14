/**
 * Cost Center Service (Phase 7)
 *
 * CRUD for cost categories + cost centers + journal-line allocations.
 * Plus a totals report that sums allocated debit/credit per center over
 * a date range (the simplest useful Tally-style cost-center report).
 *
 * Strictly additive: tenants who don't create any cost centers see no
 * runtime effect — the auto-posting flows don't touch this service.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import type {
  CostCategory,
  CostCenter,
  CostCenterWithCategory,
  CreateCostCategoryInput,
  UpdateCostCategoryInput,
  CreateCostCenterInput,
  UpdateCostCenterInput,
  CostCenterAllocationInput,
  CostCenterAllocation,
  CostCenterTotalsReport,
  CostCenterTotalsRow,
} from '@erp/shared';

export class CostCenterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'CostCenterError';
  }
}

export class CostCenterService {
  constructor(private supabase: SupabaseClient<Database>) {}

  // ==================== Cost Categories ====================

  async listCategories(tenantId: string): Promise<CostCategory[]> {
    const { data, error } = await this.supabase
      .from('cost_categories' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });
    if (error) throw error;
    return ((data as unknown) as CostCategory[]) ?? [];
  }

  async createCategory(
    tenantId: string,
    input: CreateCostCategoryInput
  ): Promise<CostCategory> {
    const { data, error } = await this.supabase
      .from('cost_categories' as any)
      .insert({ tenant_id: tenantId, name: input.name.trim() })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new CostCenterError('Category name already exists', 'NAME_EXISTS');
      }
      throw error;
    }
    return (data as unknown) as CostCategory;
  }

  async updateCategory(
    tenantId: string,
    id: string,
    input: UpdateCostCategoryInput
  ): Promise<CostCategory | null> {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.is_active !== undefined) updates.is_active = input.is_active;

    if (Object.keys(updates).length === 0) {
      return this.getCategoryById(tenantId, id);
    }

    const { data, error } = await this.supabase
      .from('cost_categories' as any)
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? ((data as unknown) as CostCategory) : null;
  }

  private async getCategoryById(
    tenantId: string,
    id: string
  ): Promise<CostCategory | null> {
    const { data, error } = await this.supabase
      .from('cost_categories' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? ((data as unknown) as CostCategory) : null;
  }

  async deleteCategory(tenantId: string, id: string): Promise<boolean> {
    // Soft delete via is_active to preserve historical allocations.
    const updated = await this.updateCategory(tenantId, id, { is_active: false });
    return updated !== null;
  }

  // ==================== Cost Centers ====================

  async listCenters(tenantId: string): Promise<CostCenterWithCategory[]> {
    const { data, error } = await this.supabase
      .from('cost_centers' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('code', { ascending: true });
    if (error) throw error;
    const centers = ((data as unknown) as CostCenter[]) ?? [];

    if (centers.length === 0) return [];

    // Hydrate category names in one round trip.
    const categoryIds = Array.from(new Set(centers.map((c) => c.category_id)));
    const { data: cats } = await this.supabase
      .from('cost_categories' as any)
      .select('id, name')
      .in('id', categoryIds);
    const catMap = new Map(
      ((cats as unknown) as { id: string; name: string }[] ?? []).map((c) => [c.id, c])
    );

    return centers.map((c) => {
      const cat = catMap.get(c.category_id);
      return cat ? { ...c, category: { id: cat.id, name: cat.name } } : c;
    });
  }

  async createCenter(
    tenantId: string,
    input: CreateCostCenterInput
  ): Promise<CostCenter> {
    // Validate the referenced category exists for this tenant.
    const cat = await this.getCategoryById(tenantId, input.category_id);
    if (!cat) {
      throw new CostCenterError('Cost category not found', 'CATEGORY_NOT_FOUND', 404);
    }

    // Validate parent_id (if provided) is a center under the same category.
    if (input.parent_id) {
      const { data: parent, error: pErr } = await this.supabase
        .from('cost_centers' as any)
        .select('id, category_id')
        .eq('tenant_id', tenantId)
        .eq('id', input.parent_id)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!parent) {
        throw new CostCenterError(
          'Parent cost center not found',
          'PARENT_NOT_FOUND',
          404
        );
      }
      if ((parent as any).category_id !== input.category_id) {
        throw new CostCenterError(
          'Parent must belong to the same category',
          'PARENT_CATEGORY_MISMATCH'
        );
      }
    }

    const { data, error } = await this.supabase
      .from('cost_centers' as any)
      .insert({
        tenant_id: tenantId,
        category_id: input.category_id,
        parent_id: input.parent_id ?? null,
        code: input.code.trim(),
        name: input.name.trim(),
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new CostCenterError('Cost center code already exists', 'CODE_EXISTS');
      }
      throw error;
    }
    return (data as unknown) as CostCenter;
  }

  async updateCenter(
    tenantId: string,
    id: string,
    input: UpdateCostCenterInput
  ): Promise<CostCenter | null> {
    const updates: Record<string, unknown> = {};
    if (input.category_id !== undefined) updates.category_id = input.category_id;
    if (input.parent_id !== undefined) updates.parent_id = input.parent_id;
    if (input.code !== undefined) updates.code = input.code.trim();
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.is_active !== undefined) updates.is_active = input.is_active;

    if (Object.keys(updates).length === 0) return this.getCenterById(tenantId, id);

    const { data, error } = await this.supabase
      .from('cost_centers' as any)
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? ((data as unknown) as CostCenter) : null;
  }

  private async getCenterById(
    tenantId: string,
    id: string
  ): Promise<CostCenter | null> {
    const { data, error } = await this.supabase
      .from('cost_centers' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? ((data as unknown) as CostCenter) : null;
  }

  async deactivateCenter(tenantId: string, id: string): Promise<boolean> {
    const updated = await this.updateCenter(tenantId, id, { is_active: false });
    return updated !== null;
  }

  // ==================== Allocations ====================

  /**
   * Tag a journal line with one or more cost centers. Replaces any
   * existing allocations on that line — call this once per edit. Sum of
   * `amount` is enforced ≤ line.debit + line.credit by the DB trigger.
   */
  async setLineAllocations(
    tenantId: string,
    journalLineId: string,
    allocations: CostCenterAllocationInput[]
  ): Promise<CostCenterAllocation[]> {
    // Validate the line belongs to this tenant.
    const { data: line, error: lErr } = await this.supabase
      .from('journal_lines')
      .select('id, debit, credit')
      .eq('tenant_id', tenantId)
      .eq('id', journalLineId)
      .maybeSingle();
    if (lErr) throw lErr;
    if (!line) {
      throw new CostCenterError('Journal line not found', 'LINE_NOT_FOUND', 404);
    }

    // Drop existing allocations and reinsert.
    const { error: dErr } = await this.supabase
      .from('journal_line_cost_allocations' as any)
      .delete()
      .eq('tenant_id', tenantId)
      .eq('journal_line_id', journalLineId);
    if (dErr) throw dErr;

    if (allocations.length === 0) return [];

    const rows = allocations.map((a) => ({
      tenant_id: tenantId,
      journal_line_id: journalLineId,
      cost_center_id: a.cost_center_id,
      amount: a.amount,
    }));

    const { data, error: iErr } = await this.supabase
      .from('journal_line_cost_allocations' as any)
      .insert(rows)
      .select();
    if (iErr) throw iErr;

    return ((data as unknown) as CostCenterAllocation[]) ?? [];
  }

  // ==================== Totals report ====================

  /**
   * Sum of allocated debit/credit per cost center over a date range. The
   * date range is applied via the parent journal_entries.entry_date —
   * only posted entries count.
   */
  async getCostCenterTotals(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<CostCenterTotalsReport> {
    // Pull all posted journal lines in the window with their allocations.
    // Doing this in two queries because PostgREST's nested-filter ergonomics
    // for "allocations of lines whose entry is posted and within dates"
    // are awkward.
    const { data: entries, error: eErr } = await this.supabase
      .from('journal_entries')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_posted', true)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);
    if (eErr) throw eErr;

    const entryIds = (entries ?? []).map((e) => e.id);
    if (entryIds.length === 0) {
      return {
        start_date: startDate,
        end_date: endDate,
        rows: [],
        grand_total_debit: 0,
        grand_total_credit: 0,
      };
    }

    const { data: lines, error: lErr } = await this.supabase
      .from('journal_lines')
      .select('id, debit, credit')
      .eq('tenant_id', tenantId)
      .in('journal_entry_id', entryIds);
    if (lErr) throw lErr;

    const lineIds = (lines ?? []).map((l) => l.id);
    if (lineIds.length === 0) {
      return {
        start_date: startDate,
        end_date: endDate,
        rows: [],
        grand_total_debit: 0,
        grand_total_credit: 0,
      };
    }
    const lineMap = new Map(
      (lines ?? []).map((l) => [
        l.id,
        { debit: Number(l.debit ?? 0), credit: Number(l.credit ?? 0) },
      ])
    );

    const { data: allocations, error: aErr } = await this.supabase
      .from('journal_line_cost_allocations' as any)
      .select('journal_line_id, cost_center_id, amount')
      .eq('tenant_id', tenantId)
      .in('journal_line_id', lineIds);
    if (aErr) throw aErr;

    type Alloc = { journal_line_id: string; cost_center_id: string; amount: number };
    const allocRows = ((allocations as unknown) as Alloc[]) ?? [];
    if (allocRows.length === 0) {
      return {
        start_date: startDate,
        end_date: endDate,
        rows: [],
        grand_total_debit: 0,
        grand_total_credit: 0,
      };
    }

    // Aggregate per center, splitting the allocation amount into debit/credit
    // proportional to the originating line's debit/credit (always one or the
    // other, since journal_lines enforces XOR).
    const perCenter = new Map<string, { debit: number; credit: number }>();
    for (const a of allocRows) {
      const line = lineMap.get(a.journal_line_id);
      if (!line) continue;
      const cur = perCenter.get(a.cost_center_id) ?? { debit: 0, credit: 0 };
      if (line.debit > 0) cur.debit += Number(a.amount);
      else cur.credit += Number(a.amount);
      perCenter.set(a.cost_center_id, cur);
    }

    // Hydrate center + category names.
    const centerIds = Array.from(perCenter.keys());
    const { data: centers, error: cErr } = await this.supabase
      .from('cost_centers' as any)
      .select('id, code, name, category_id')
      .in('id', centerIds);
    if (cErr) throw cErr;
    type CRow = { id: string; code: string; name: string; category_id: string };
    const centerMap = new Map(((centers as unknown) as CRow[] ?? []).map((c) => [c.id, c]));

    const categoryIds = Array.from(
      new Set(((centers as unknown) as CRow[] ?? []).map((c) => c.category_id))
    );
    const { data: cats } = await this.supabase
      .from('cost_categories' as any)
      .select('id, name')
      .in('id', categoryIds);
    type CatRow = { id: string; name: string };
    const catMap = new Map(((cats as unknown) as CatRow[] ?? []).map((c) => [c.id, c]));

    const rows: CostCenterTotalsRow[] = [];
    let gDebit = 0;
    let gCredit = 0;
    for (const [centerId, agg] of perCenter.entries()) {
      const center = centerMap.get(centerId);
      const cat = center ? catMap.get(center.category_id) : undefined;
      const debit = Math.round(agg.debit * 100) / 100;
      const credit = Math.round(agg.credit * 100) / 100;
      gDebit += debit;
      gCredit += credit;
      rows.push({
        cost_center_id: centerId,
        cost_center_code: center?.code ?? '',
        cost_center_name: center?.name ?? 'Unknown',
        category_id: center?.category_id ?? '',
        category_name: cat?.name ?? 'Unknown',
        total_debit: debit,
        total_credit: credit,
        net: Math.round((debit - credit) * 100) / 100,
      });
    }

    rows.sort(
      (a, b) =>
        a.category_name.localeCompare(b.category_name) ||
        a.cost_center_code.localeCompare(b.cost_center_code)
    );

    return {
      start_date: startDate,
      end_date: endDate,
      rows,
      grand_total_debit: Math.round(gDebit * 100) / 100,
      grand_total_credit: Math.round(gCredit * 100) / 100,
    };
  }
}
