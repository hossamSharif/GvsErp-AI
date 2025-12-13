/**
 * Permission Constants and Role Defaults
 *
 * Centralized permission definitions and default role configurations.
 */

import type { Permission, SystemRoleName } from '../types/core';

// ============================================
// PERMISSION CATEGORIES
// ============================================

export const ITEM_PERMISSIONS = [
  'items:read',
  'items:write',
  'items:delete',
] as const;

export const INVOICE_PERMISSIONS = [
  'invoices:read',
  'invoices:write',
  'invoices:delete',
  'invoices:finalize',
] as const;

export const PARTY_PERMISSIONS = [
  'parties:read',
  'parties:write',
  'parties:delete',
] as const;

export const PAYMENT_PERMISSIONS = [
  'payments:read',
  'payments:write',
  'payments:delete',
] as const;

export const WAREHOUSE_PERMISSIONS = [
  'warehouses:read',
  'warehouses:write',
  'warehouses:delete',
] as const;

export const INVENTORY_PERMISSIONS = [
  'inventory:read',
  'inventory:write',
] as const;

export const TRANSFER_PERMISSIONS = [
  'transfers:read',
  'transfers:write',
  'transfers:complete',
] as const;

export const EXPENSE_PERMISSIONS = [
  'expenses:read',
  'expenses:write',
  'expenses:delete',
] as const;

export const REPORT_PERMISSIONS = [
  'reports:read',
  'reports:export',
] as const;

export const USER_PERMISSIONS = [
  'users:read',
  'users:write',
  'users:delete',
] as const;

export const ROLE_PERMISSIONS = [
  'roles:read',
  'roles:write',
  'roles:delete',
] as const;

export const SETTINGS_PERMISSIONS = [
  'settings:read',
  'settings:write',
] as const;

export const ACCOUNTING_PERMISSIONS = [
  'accounting:read',
  'accounting:write',
] as const;

export const HR_PERMISSIONS = [
  'hr:read',
  'hr:write',
] as const;

// ============================================
// ALL PERMISSIONS
// ============================================

export const ALL_PERMISSIONS: Permission[] = [
  '*',
  ...ITEM_PERMISSIONS,
  ...INVOICE_PERMISSIONS,
  ...PARTY_PERMISSIONS,
  ...PAYMENT_PERMISSIONS,
  ...WAREHOUSE_PERMISSIONS,
  ...INVENTORY_PERMISSIONS,
  ...TRANSFER_PERMISSIONS,
  ...EXPENSE_PERMISSIONS,
  ...REPORT_PERMISSIONS,
  ...USER_PERMISSIONS,
  ...ROLE_PERMISSIONS,
  ...SETTINGS_PERMISSIONS,
  ...ACCOUNTING_PERMISSIONS,
  ...HR_PERMISSIONS,
];

// ============================================
// DEFAULT ROLE CONFIGURATIONS
// ============================================

export const DEFAULT_ROLES: Record<SystemRoleName, {
  name: string;
  description: string;
  permissions: Permission[];
}> = {
  admin: {
    name: 'Admin',
    description: 'Full access to all features',
    permissions: ['*'],
  },
  sales: {
    name: 'Sales',
    description: 'Manage sales, customers, and basic item viewing',
    permissions: [
      'items:read',
      'invoices:read',
      'invoices:write',
      'invoices:finalize',
      'parties:read',
      'parties:write',
      'payments:read',
      'payments:write',
      'reports:read',
    ],
  },
  warehouse: {
    name: 'Warehouse',
    description: 'Manage inventory, warehouses, and stock transfers',
    permissions: [
      'items:read',
      'items:write',
      'warehouses:read',
      'warehouses:write',
      'inventory:read',
      'inventory:write',
      'transfers:read',
      'transfers:write',
      'transfers:complete',
    ],
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only access to most features',
    permissions: [
      'items:read',
      'invoices:read',
      'parties:read',
      'warehouses:read',
      'inventory:read',
      'reports:read',
    ],
  },
};

// ============================================
// PERMISSION HELPERS
// ============================================

/**
 * Check if a set of permissions includes a specific permission.
 * Handles wildcard (*) permission.
 */
export function hasPermission(
  userPermissions: Permission[],
  requiredPermission: Permission
): boolean {
  // Wildcard grants all permissions
  if (userPermissions.includes('*')) {
    return true;
  }

  return userPermissions.includes(requiredPermission);
}

/**
 * Check if a set of permissions includes ALL of the required permissions.
 */
export function hasAllPermissions(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.every((permission) =>
    hasPermission(userPermissions, permission)
  );
}

/**
 * Check if a set of permissions includes ANY of the required permissions.
 */
export function hasAnyPermission(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.some((permission) =>
    hasPermission(userPermissions, permission)
  );
}

/**
 * Get human-readable permission label.
 */
export function getPermissionLabel(permission: Permission): string {
  const labels: Record<Permission, string> = {
    '*': 'Full Access',
    'items:read': 'View Items',
    'items:write': 'Create/Edit Items',
    'items:delete': 'Delete Items',
    'invoices:read': 'View Invoices',
    'invoices:write': 'Create/Edit Invoices',
    'invoices:delete': 'Delete Invoices',
    'invoices:finalize': 'Finalize Invoices',
    'parties:read': 'View Customers/Suppliers',
    'parties:write': 'Create/Edit Customers/Suppliers',
    'parties:delete': 'Delete Customers/Suppliers',
    'payments:read': 'View Payments',
    'payments:write': 'Record Payments',
    'payments:delete': 'Delete Payments',
    'warehouses:read': 'View Warehouses',
    'warehouses:write': 'Create/Edit Warehouses',
    'warehouses:delete': 'Delete Warehouses',
    'inventory:read': 'View Inventory',
    'inventory:write': 'Adjust Inventory',
    'transfers:read': 'View Transfers',
    'transfers:write': 'Create Transfers',
    'transfers:complete': 'Complete Transfers',
    'expenses:read': 'View Expenses',
    'expenses:write': 'Create/Edit Expenses',
    'expenses:delete': 'Delete Expenses',
    'reports:read': 'View Reports',
    'reports:export': 'Export Reports',
    'users:read': 'View Users',
    'users:write': 'Create/Edit Users',
    'users:delete': 'Delete Users',
    'roles:read': 'View Roles',
    'roles:write': 'Create/Edit Roles',
    'roles:delete': 'Delete Roles',
    'settings:read': 'View Settings',
    'settings:write': 'Edit Settings',
    'accounting:read': 'View Accounting',
    'accounting:write': 'Manage Accounting',
    'hr:read': 'View HR',
    'hr:write': 'Manage HR',
  };

  return labels[permission] || permission;
}

/**
 * Group permissions by category for UI display.
 */
export function getPermissionsByCategory(): Record<string, Permission[]> {
  return {
    'Items': [...ITEM_PERMISSIONS],
    'Invoices': [...INVOICE_PERMISSIONS],
    'Customers & Suppliers': [...PARTY_PERMISSIONS],
    'Payments': [...PAYMENT_PERMISSIONS],
    'Warehouses': [...WAREHOUSE_PERMISSIONS],
    'Inventory': [...INVENTORY_PERMISSIONS],
    'Transfers': [...TRANSFER_PERMISSIONS],
    'Expenses': [...EXPENSE_PERMISSIONS],
    'Reports': [...REPORT_PERMISSIONS],
    'Users': [...USER_PERMISSIONS],
    'Roles': [...ROLE_PERMISSIONS],
    'Settings': [...SETTINGS_PERMISSIONS],
    'Accounting': [...ACCOUNTING_PERMISSIONS],
    'HR': [...HR_PERMISSIONS],
  };
}

// ============================================
// SUBSCRIPTION LIMITS
// ============================================

export const SUBSCRIPTION_LIMITS = {
  freemium: {
    max_items: 50,
    max_users: 1,
    max_transactions_per_month: 25,
    pdf_export: false,
    accounting_module: false,
    hr_module: false,
  },
  premium: {
    max_items: -1, // unlimited
    max_users: -1, // unlimited
    max_transactions_per_month: -1, // unlimited
    pdf_export: true,
    accounting_module: true,
    hr_module: true,
  },
} as const;

export type SubscriptionLimits = typeof SUBSCRIPTION_LIMITS[keyof typeof SUBSCRIPTION_LIMITS];
