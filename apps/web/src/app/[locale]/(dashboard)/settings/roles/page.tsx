'use client';

/**
 * Roles Management Page
 *
 * Manage roles with:
 * - Role list with permissions
 * - Create/edit roles
 * - Permission management
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useRoles, useDeleteRole, useCreateRole, useUpdateRole } from '@/hooks/use-roles';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Role, CreateRoleInput, UpdateRoleInput } from '@erp/shared';
import { PERMISSIONS } from '@erp/shared';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Shield,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

// Form schema
const roleFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
});

type RoleFormData = z.infer<typeof roleFormSchema>;

interface RoleQueryParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: 'name' | 'created_at';
  sortDir?: 'asc' | 'desc';
}

// Group permissions by category
const permissionGroups = {
  Items: [
    PERMISSIONS.ITEMS_READ,
    PERMISSIONS.ITEMS_WRITE,
    PERMISSIONS.ITEMS_DELETE,
  ],
  Invoices: [
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.INVOICES_WRITE,
    PERMISSIONS.INVOICES_DELETE,
    PERMISSIONS.INVOICES_FINALIZE,
    PERMISSIONS.INVOICES_RETURN,
  ],
  Warehouses: [
    PERMISSIONS.WAREHOUSES_READ,
    PERMISSIONS.WAREHOUSES_WRITE,
    PERMISSIONS.WAREHOUSES_DELETE,
  ],
  Transfers: [
    PERMISSIONS.TRANSFERS_READ,
    PERMISSIONS.TRANSFERS_WRITE,
    PERMISSIONS.TRANSFERS_COMPLETE,
  ],
  Parties: [
    PERMISSIONS.PARTIES_READ,
    PERMISSIONS.PARTIES_WRITE,
    PERMISSIONS.PARTIES_DELETE,
  ],
  Payments: [
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.PAYMENTS_WRITE,
    PERMISSIONS.PAYMENTS_DELETE,
  ],
  Expenses: [
    PERMISSIONS.EXPENSES_READ,
    PERMISSIONS.EXPENSES_WRITE,
    PERMISSIONS.EXPENSES_DELETE,
  ],
  Reports: [
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
  ],
  Settings: [
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_WRITE,
  ],
  Users: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_WRITE,
    PERMISSIONS.USERS_DELETE,
  ],
  Roles: [
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.ROLES_WRITE,
    PERMISSIONS.ROLES_DELETE,
  ],
  'Audit Logs': [
    PERMISSIONS.AUDIT_READ,
  ],
  Accounting: [
    PERMISSIONS.ACCOUNTING_READ,
    PERMISSIONS.ACCOUNTING_WRITE,
  ],
  HR: [
    PERMISSIONS.HR_READ,
    PERMISSIONS.HR_WRITE,
  ],
};

export default function RolesPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();

  // Query state
  const [queryParams, setQueryParams] = useState<RoleQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'name',
    sortDir: 'asc',
  });

  // UI state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  // Fetch roles
  const { data, isLoading, error } = useRoles(queryParams);

  // Mutations
  const createMutation = useCreateRole({
    onSuccess: () => {
      toast({
        title: 'Role created',
        description: 'The role has been created successfully.',
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create role',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useUpdateRole({
    onSuccess: () => {
      toast({
        title: 'Role updated',
        description: 'The role has been updated successfully.',
      });
      setDialogOpen(false);
      setEditingRole(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useDeleteRole({
    onSuccess: () => {
      toast({
        title: 'Role deleted',
        description: 'The role has been deleted successfully.',
      });
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete role',
        variant: 'destructive',
      });
    },
  });

  // Form
  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: '',
      permissions: [],
    },
  });

  // Handlers
  const handlePageChange = useCallback((page: number, limit: number) => {
    setQueryParams((prev) => ({ ...prev, page, limit }));
  }, []);

  const handleSortChange = useCallback((sorting: { id: string; desc: boolean }[]) => {
    if (sorting.length > 0) {
      setQueryParams((prev) => ({
        ...prev,
        sortBy: sorting[0].id as RoleQueryParams['sortBy'],
        sortDir: sorting[0].desc ? 'desc' : 'asc',
      }));
    }
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQueryParams((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handleAddRole = useCallback(() => {
    setEditingRole(null);
    form.reset({
      name: '',
      permissions: [],
    });
    setDialogOpen(true);
  }, [form]);

  const handleEditRole = useCallback(
    (role: Role) => {
      setEditingRole(role);
      form.reset({
        name: role.name,
        permissions: role.permissions,
      });
      setDialogOpen(true);
    },
    [form]
  );

  const handleDeleteRole = useCallback((role: Role) => {
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (roleToDelete) {
      deleteMutation.mutate(roleToDelete.id);
    }
  }, [roleToDelete, deleteMutation]);

  const onSubmit = useCallback(
    (data: RoleFormData) => {
      if (editingRole) {
        // Update existing role
        const updateData: UpdateRoleInput = {
          name: data.name,
          permissions: data.permissions,
        };
        updateMutation.mutate({ id: editingRole.id, input: updateData });
      } else {
        // Create new role
        const createData: CreateRoleInput = {
          name: data.name,
          permissions: data.permissions,
        };
        createMutation.mutate(createData);
      }
    },
    [editingRole, createMutation, updateMutation]
  );

  // Table columns
  const columns = useMemo<ColumnDef<Role>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Role Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{row.original.name}</span>
            {row.original.is_system && (
              <Badge variant="secondary" className="ml-2">
                System
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'permissions',
        header: 'Permissions',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{row.original.permissions.length} permissions</Badge>
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleEditRole(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {!row.original.is_system && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDeleteRole(row.original)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [handleEditRole, handleDeleteRole]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/settings`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
            <p className="text-muted-foreground">
              Configure roles and access control for users
            </p>
          </div>
        </div>
        <Button onClick={handleAddRole}>
          <Plus className="mr-2 h-4 w-4" />
          Add Role
        </Button>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        pageCount={data?.meta.total ? Math.ceil(data.meta.total / queryParams.limit) : 0}
        pageIndex={queryParams.page - 1}
        pageSize={queryParams.limit}
        onPageChange={handlePageChange}
        onSortingChange={handleSortChange}
        onSearchChange={handleSearch}
        searchPlaceholder="Search roles..."
        isLoading={isLoading}
      />

      {/* Role Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Add Role'}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? 'Update the role details and permissions below.'
                : 'Fill in the role details and select permissions below.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Sales Manager" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="permissions"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Permissions</FormLabel>
                      <FormDescription>
                        Select the permissions for this role
                      </FormDescription>
                    </div>
                    <ScrollArea className="h-[400px] rounded-md border p-4">
                      {Object.entries(permissionGroups).map(([group, permissions]) => (
                        <div key={group} className="mb-4">
                          <h4 className="mb-2 font-medium">{group}</h4>
                          <div className="space-y-2 pl-4">
                            {permissions.map((permission) => (
                              <FormField
                                key={permission}
                                control={form.control}
                                name="permissions"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={permission}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(permission)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, permission])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== permission
                                                  )
                                                );
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-normal">
                                        {permission.replace(/:/g, ' - ')}
                                      </FormLabel>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingRole ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the role "{roleToDelete?.name}". This action cannot be undone.
              Users with this role will lose their permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
