/**
 * Category Repository
 *
 * Handles data access for item categories with hierarchical support.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository } from './base.repository';
import type { Category, CategoryWithChildren } from '@erp/shared';

type CategoryRow = Database['public']['Tables']['categories']['Row'];
type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

/**
 * Repository for Category entity
 */
export class CategoryRepository extends BaseRepository<'categories', CategoryRow, CategoryInsert, CategoryUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'categories');
  }

  /**
   * Get all categories as a flat list
   */
  async findAllFlat(tenantId: string): Promise<Category[]> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapCategory);
  }

  /**
   * Get root categories (no parent)
   */
  async findRoots(tenantId: string): Promise<Category[]> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('parent_id', null)
      .order('name');

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapCategory);
  }

  /**
   * Get children of a category
   */
  async findChildren(tenantId: string, parentId: string): Promise<Category[]> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('parent_id', parentId)
      .order('name');

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapCategory);
  }

  /**
   * Get categories as a tree structure
   */
  async findAsTree(tenantId: string): Promise<CategoryWithChildren[]> {
    const allCategories = await this.findAllFlat(tenantId);
    return this.buildTree(allCategories);
  }

  /**
   * Get a single category with its children
   */
  async findByIdWithChildren(tenantId: string, id: string): Promise<CategoryWithChildren | null> {
    const category = await this.findById(tenantId, id);
    if (!category) {
      return null;
    }

    const children = await this.findAllDescendants(tenantId, id);
    const mappedCategory = this.mapCategory(category);

    return {
      ...mappedCategory,
      children: this.buildTree(children, id),
    };
  }

  /**
   * Get all descendants of a category
   */
  async findAllDescendants(tenantId: string, parentId: string): Promise<Category[]> {
    // Use recursive CTE for PostgreSQL
    const { data, error } = await this.supabase.rpc('get_category_descendants', {
      p_tenant_id: tenantId,
      p_parent_id: parentId,
    });

    if (error) {
      // Fallback to manual recursion if RPC not available
      return this.findDescendantsManually(tenantId, parentId);
    }

    return (data || []).map(this.mapCategory);
  }

  /**
   * Manual recursive fetch of descendants (fallback)
   */
  private async findDescendantsManually(
    tenantId: string,
    parentId: string,
    maxDepth: number = 5
  ): Promise<Category[]> {
    if (maxDepth <= 0) return [];

    const children = await this.findChildren(tenantId, parentId);
    const descendants: Category[] = [...children];

    for (const child of children) {
      const childDescendants = await this.findDescendantsManually(tenantId, child.id, maxDepth - 1);
      descendants.push(...childDescendants);
    }

    return descendants;
  }

  /**
   * Get the path from root to a category
   */
  async findPath(tenantId: string, categoryId: string): Promise<Category[]> {
    const path: Category[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category = await this.findById(tenantId, currentId);
      if (!category) break;

      path.unshift(this.mapCategory(category));
      currentId = category.parent_id;
    }

    return path;
  }

  /**
   * Check if a category has items
   */
  async hasItems(tenantId: string, categoryId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('category_id', categoryId);

    if (error) {
      throw error;
    }

    return (count || 0) > 0;
  }

  /**
   * Check if a category has children
   */
  async hasChildren(tenantId: string, categoryId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('categories')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('parent_id', categoryId);

    if (error) {
      throw error;
    }

    return (count || 0) > 0;
  }

  /**
   * Get depth of a category in the hierarchy
   */
  async getDepth(tenantId: string, categoryId: string): Promise<number> {
    const path = await this.findPath(tenantId, categoryId);
    return path.length - 1; // Root is depth 0
  }

  /**
   * Check if moving category to new parent would create a cycle or exceed max depth
   */
  async validateMove(
    tenantId: string,
    categoryId: string,
    newParentId: string | null
  ): Promise<{ valid: boolean; error?: string }> {
    // No parent is always valid
    if (!newParentId) {
      return { valid: true };
    }

    // Cannot be own parent
    if (categoryId === newParentId) {
      return { valid: false, error: 'Category cannot be its own parent' };
    }

    // Check for circular reference - new parent cannot be a descendant
    const descendants = await this.findAllDescendants(tenantId, categoryId);
    if (descendants.some((d) => d.id === newParentId)) {
      return { valid: false, error: 'Cannot move category to one of its descendants' };
    }

    // Check max depth (5 levels)
    const newParentPath = await this.findPath(tenantId, newParentId);
    const categoryDescendants = descendants;
    const maxDescendantDepth = categoryDescendants.length > 0
      ? await this.getMaxDescendantDepth(tenantId, categoryId)
      : 0;

    if (newParentPath.length + 1 + maxDescendantDepth > 5) {
      return { valid: false, error: 'Move would exceed maximum category depth of 5 levels' };
    }

    return { valid: true };
  }

  /**
   * Get maximum depth of descendants
   */
  private async getMaxDescendantDepth(tenantId: string, categoryId: string): Promise<number> {
    const descendants = await this.findAllDescendants(tenantId, categoryId);
    if (descendants.length === 0) return 0;

    let maxDepth = 0;
    for (const desc of descendants) {
      const path = await this.findPath(tenantId, desc.id);
      const depthFromCategory = path.findIndex((c) => c.id === categoryId);
      if (depthFromCategory >= 0) {
        const depth = path.length - depthFromCategory - 1;
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    return maxDepth;
  }

  /**
   * Search categories by name
   */
  async search(tenantId: string, query: string): Promise<Category[]> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(50);

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapCategory);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Build a tree structure from a flat list of categories
   */
  private buildTree(categories: Category[], parentId: string | null = null): CategoryWithChildren[] {
    return categories
      .filter((cat) => cat.parentId === parentId)
      .map((cat) => ({
        ...cat,
        children: this.buildTree(categories, cat.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private mapCategory = (row: CategoryRow): Category => {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      parentId: row.parent_id,
      createdAt: row.created_at,
    };
  };
}
