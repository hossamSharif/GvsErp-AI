'use client';

/**
 * Users Management Page
 *
 * Manage users with:
 * - User list with roles
 * - Create/edit users
 * - Activate/deactivate users
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { useUsers, useDeleteUser, useCreateUser, useUpdateUser } from '@/hooks/use-users';
import { useRoles } from '@/hooks/use-roles';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { User, UserWithRole, CreateUserInput, UpdateUserInput } from '@erp/shared';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserX,
  UserCheck,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

// Form schema
// password accepts '' (edit mode prefill) or a >=8 char string (create mode).
// `.min(8).optional()` alone rejects '' because `.optional()` only excuses `undefined`.
const userFormSchema = z.object({
  email: z.string().email('Invalid email format'),
  full_name: z.string().min(1, 'Name is required').max(255),
  role_id: z.string().optional(),
  password: z
    .string()
    .refine((v) => v === '' || v.length >= 8, {
      message: 'Password must be at least 8 characters',
    })
    .optional(),
  is_active: z.boolean().default(true),
  preferences: z.object({
    language: z.enum(['en', 'ar']).optional(),
    theme: z.enum(['light', 'dark']).optional(),
  }).optional(),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface UserQueryParams {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  includeInactive?: boolean;
  roleId?: string;
  sortBy?: 'full_name' | 'email' | 'created_at';
  sortDir?: 'asc' | 'desc';
}

export default function UsersPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const t = useTranslations('users');

  // Query state
  // includeInactive: show inactive users so admins can re-activate them
  // (the Activate row action only renders for inactive users).
  const [queryParams, setQueryParams] = useState<UserQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'full_name',
    sortDir: 'asc',
    includeInactive: true,
  });

  // UI state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Fetch users
  const { data, isLoading, error } = useUsers(queryParams);

  // Fetch roles for dropdown
  const { data: rolesData } = useRoles({ limit: 100 });

  // Mutations
  const createMutation = useCreateUser({
    onSuccess: () => {
      toast({
        title: t('toast.createdTitle'),
        description: t('toast.createdDescription'),
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: t('toast.errorTitle'),
        description: error.message || t('toast.errorCreate'),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useUpdateUser({
    onSuccess: () => {
      toast({
        title: t('toast.updatedTitle'),
        description: t('toast.updatedDescription'),
      });
      setDialogOpen(false);
      setEditingUser(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: t('toast.errorTitle'),
        description: error.message || t('toast.errorUpdate'),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useDeleteUser({
    onSuccess: () => {
      toast({
        title: t('toast.deletedTitle'),
        description: t('toast.deletedDescription'),
      });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error) => {
      toast({
        title: t('toast.errorTitle'),
        description: error.message || t('toast.errorDelete'),
        variant: 'destructive',
      });
    },
  });

  // Form
  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: '',
      full_name: '',
      role_id: '',
      password: '',
      is_active: true,
      preferences: {
        language: 'en',
        theme: 'light',
      },
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
        sortBy: sorting[0].id as UserQueryParams['sortBy'],
        sortDir: sorting[0].desc ? 'desc' : 'asc',
      }));
    }
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQueryParams((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handleAddUser = useCallback(() => {
    setEditingUser(null);
    form.reset({
      email: '',
      full_name: '',
      role_id: '',
      password: '',
      is_active: true,
      preferences: {
        language: 'en',
        theme: 'light',
      },
    });
    setDialogOpen(true);
  }, [form]);

  const handleEditUser = useCallback(
    (user: User) => {
      setEditingUser(user);
      form.reset({
        email: user.email,
        full_name: user.full_name || '',
        role_id: user.role_id || '',
        password: '',
        is_active: user.is_active,
        preferences: user.preferences || { language: 'en', theme: 'light' },
      });
      setDialogOpen(true);
    },
    [form]
  );

  const handleDeleteUser = useCallback((user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  }, []);

  const handleToggleActive = useCallback(
    (user: User) => {
      updateMutation.mutate({
        id: user.id,
        input: { is_active: !user.is_active },
      });
    },
    [updateMutation]
  );

  const confirmDelete = useCallback(() => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id);
    }
  }, [userToDelete, deleteMutation]);

  const onSubmit = useCallback(
    (data: UserFormData) => {
      if (editingUser) {
        // Update existing user
        const updateData: UpdateUserInput = {
          email: data.email,
          full_name: data.full_name,
          role_id: data.role_id || undefined,
          is_active: data.is_active,
          preferences: data.preferences,
        };
        updateMutation.mutate({ id: editingUser.id, input: updateData });
      } else {
        // Create new user
        const createData: CreateUserInput = {
          email: data.email,
          full_name: data.full_name,
          role_id: data.role_id || undefined,
          password: data.password!,
          preferences: data.preferences,
        };
        createMutation.mutate(createData);
      }
    },
    [editingUser, createMutation, updateMutation]
  );

  // Table columns
  const columns = useMemo<ColumnDef<UserWithRole>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: t('columns.name'),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.full_name || 'N/A'}</span>
            <span className="text-sm text-muted-foreground">{row.original.email}</span>
          </div>
        ),
      },
      {
        accessorKey: 'role',
        header: t('columns.role'),
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.role?.name || t('noRole')}</Badge>
        ),
      },
      {
        accessorKey: 'is_active',
        header: t('columns.status'),
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? 'default' : 'secondary'}>
            {row.original.is_active ? t('status.active') : t('status.inactive')}
          </Badge>
        ),
      },
      {
        accessorKey: 'preferences',
        header: t('columns.language'),
        cell: ({ row }) => {
          const lang = row.original.preferences?.language || 'en';
          return <span>{t(`language.${lang}` as 'language.en' | 'language.ar')}</span>;
        },
      },
      {
        id: 'actions',
        header: t('columns.actions'),
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{t('actions.openMenu')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('actions.label')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleEditUser(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleActive(row.original)}>
                {row.original.is_active ? (
                  <>
                    <UserX className="mr-2 h-4 w-4" />
                    {t('actions.deactivate')}
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    {t('actions.activate')}
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteUser(row.original)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, handleEditUser, handleToggleActive, handleDeleteUser]
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
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <Button onClick={handleAddUser}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addUser')}
        </Button>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={(data?.data || []) as UserWithRole[]}
        pageCount={data?.meta.total ? Math.ceil(data.meta.total / queryParams.limit) : 0}
        pageIndex={queryParams.page - 1}
        pageSize={queryParams.limit}
        onPageChange={handlePageChange}
        onSortingChange={handleSortChange}
        onSearchChange={handleSearch}
        searchPlaceholder={t('searchPlaceholder')}
        isLoading={isLoading}
      />

      {/* User Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? t('form.editTitle') : t('form.addTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingUser ? t('form.editDescription') : t('form.addDescription')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.fullNameLabel')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('form.fullNamePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.emailLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t('form.emailPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!editingUser && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.passwordLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t('form.passwordPlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>{t('form.passwordDescription')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="role_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.roleLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.rolePlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {rolesData?.data.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preferences.language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.languageLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="en">{t('language.en')}</SelectItem>
                        <SelectItem value="ar">{t('language.ar')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {editingUser && (
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>{t('form.activeLabel')}</FormLabel>
                        <FormDescription>{t('form.activeDescription')}</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t('form.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingUser ? t('form.update') : t('form.create')}
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
            <AlertDialogTitle>{t('delete.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.confirmBody', {
                name: userToDelete?.full_name || userToDelete?.email || '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
