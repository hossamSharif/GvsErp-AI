/**
 * Cost center types (Phase 7).
 *
 * Cost categories are the top-level reporting dimension (Department,
 * Project, Branch). Cost centers are the units within a category that
 * postings get tagged with. A single journal line can be split across
 * multiple centers via journal_line_cost_allocations.
 */

export interface CostCategory {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCostCategoryInput {
  name: string;
}

export interface UpdateCostCategoryInput {
  name?: string;
  is_active?: boolean;
}

export interface CostCenter {
  id: string;
  tenant_id: string;
  category_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CostCenterWithCategory extends CostCenter {
  category?: { id: string; name: string };
}

export interface CreateCostCenterInput {
  category_id: string;
  parent_id?: string;
  code: string;
  name: string;
}

export interface UpdateCostCenterInput {
  category_id?: string;
  parent_id?: string | null;
  code?: string;
  name?: string;
  is_active?: boolean;
}

/** A single line→center tag. The frontend allocation editor sends these. */
export interface CostCenterAllocationInput {
  cost_center_id: string;
  amount: number;
}

export interface CostCenterAllocation {
  id: string;
  tenant_id: string;
  journal_line_id: string;
  cost_center_id: string;
  amount: number;
  created_at: string;
}

/** Totals report row — sum of allocated debit/credit for one center. */
export interface CostCenterTotalsRow {
  cost_center_id: string;
  cost_center_code: string;
  cost_center_name: string;
  category_id: string;
  category_name: string;
  total_debit: number;
  total_credit: number;
  net: number;
}

export interface CostCenterTotalsReport {
  start_date: string;
  end_date: string;
  rows: CostCenterTotalsRow[];
  grand_total_debit: number;
  grand_total_credit: number;
}
