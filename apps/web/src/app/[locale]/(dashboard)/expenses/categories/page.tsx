'use client';

/**
 * Expense Categories Page
 *
 * Manage the tenant's expense categories:
 * - Add / rename categories (rename also updates existing expenses)
 * - Activate / deactivate (inactive ones are hidden from new expenses)
 * - Delete unused categories
 */

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  useExpenseCategories,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
} from '@/hooks/use-expenses';
import { useDirection } from '@/hooks/use-direction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { labelForExpenseCategory } from '@/lib/expense-category-label';
import type { ExpenseCategoryRecord } from '@erp/shared';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  Power,
  Tags,
  Loader2,
} from 'lucide-react';

export default function ExpenseCategoriesPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const { isRtl } = useDirection();
  const t = useTranslations('expenses');
  const tp = useTranslations('expenses.categoriesPage');

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  // UI state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategoryRecord | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [categoryToDelete, setCategoryToDelete] = useState<ExpenseCategoryRecord | null>(null);

  const { data, isLoading } = useExpenseCategories({ includeInactive: true });
  const categories = data?.data ?? [];

  const errorMessage = useCallback(
    (error: Error, fallback: string) => {
      const code = (error as Error & { code?: string }).code;
      if (code === 'CATEGORY_EXISTS') return tp('errors.exists');
      if (code === 'CATEGORY_IN_USE') return tp('errors.inUse');
      return error.message || fallback;
    },
    [tp]
  );

  const showError = useCallback(
    (error: Error, fallback: string) => {
      toast({
        title: t('toast.error'),
        description: errorMessage(error, fallback),
        variant: 'destructive',
      });
    },
    [toast, t, errorMessage]
  );

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingCategory(null);
    setCategoryName('');
    setIsActive(true);
  }, []);

  const createMutation = useCreateExpenseCategory({
    onSuccess: () => {
      toast({ title: tp('toast.created') });
      closeDialog();
    },
    onError: (error) => showError(error, tp('toast.createError')),
  });

  const updateMutation = useUpdateExpenseCategory({
    onSuccess: () => {
      toast({ title: tp('toast.updated') });
      closeDialog();
    },
    onError: (error) => showError(error, tp('toast.updateError')),
  });

  const deleteMutation = useDeleteExpenseCategory({
    onSuccess: () => {
      toast({ title: tp('toast.deleted') });
      setCategoryToDelete(null);
    },
    onError: (error) => {
      showError(error, tp('toast.deleteError'));
      setCategoryToDelete(null);
    },
  });

  // Handlers
  const openCreateDialog = useCallback(() => {
    setEditingCategory(null);
    setCategoryName('');
    setIsActive(true);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback(
    (category: ExpenseCategoryRecord) => {
      setEditingCategory(category);
      // Built-in keys start out as their translated label so users edit readable text
      setCategoryName(labelForExpenseCategory(category.name, t));
      setIsActive(category.isActive);
      setDialogOpen(true);
    },
    [t]
  );

  const handleSubmit = useCallback(() => {
    const name = categoryName.trim();
    if (!name) return;

    if (editingCategory) {
      const nameChanged = name !== labelForExpenseCategory(editingCategory.name, t);
      updateMutation.mutate({
        id: editingCategory.id,
        input: {
          ...(nameChanged ? { name } : {}),
          isActive,
        },
      });
    } else {
      createMutation.mutate({ name });
    }
  }, [categoryName, editingCategory, isActive, t, createMutation, updateMutation]);

  const toggleActive = useCallback(
    (category: ExpenseCategoryRecord) => {
      updateMutation.mutate({
        id: category.id,
        input: { isActive: !category.isActive },
      });
    },
    [updateMutation]
  );

  const confirmDelete = useCallback(() => {
    if (categoryToDelete) {
      deleteMutation.mutate({ id: categoryToDelete.id });
    }
  }, [categoryToDelete, deleteMutation]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/expenses`)}
            aria-label={tp('back')}
          >
            <BackIcon className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{tp('title')}</h1>
            <p className="text-muted-foreground">{tp('description')}</p>
          </div>
        </div>
        <Button onClick={openCreateDialog} data-testid="expense-category-add">
          <Plus className="mr-2 h-4 w-4" />
          {tp('addButton')}
        </Button>
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>{tp('listTitle')}</CardTitle>
          <CardDescription>{tp('listDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tags className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>{tp('emptyTitle')}</p>
              <p className="text-sm">{tp('emptyHint')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{tp('columns.name')}</TableHead>
                  <TableHead className="text-start">{tp('columns.usage')}</TableHead>
                  <TableHead className="text-start">{tp('columns.status')}</TableHead>
                  <TableHead className="text-end">{t('fields.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => {
                  const label = labelForExpenseCategory(category.name, t);
                  const inUse = category.expenseCount > 0;
                  return (
                    <TableRow key={category.id} data-testid="expense-category-row">
                      <TableCell className="font-medium">{label}</TableCell>
                      <TableCell>
                        {tp('usageCount', { count: category.expenseCount })}
                      </TableCell>
                      <TableCell>
                        {category.isActive ? (
                          <Badge variant="outline">{tp('status.active')}</Badge>
                        ) : (
                          <Badge variant="secondary">{tp('status.inactive')}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(category)}
                            aria-label={tp('actions.editAria', { name: label })}
                            title={t('actions.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleActive(category)}
                            disabled={updateMutation.isPending}
                            aria-label={
                              category.isActive
                                ? tp('actions.deactivateAria', { name: label })
                                : tp('actions.activateAria', { name: label })
                            }
                            title={
                              category.isActive
                                ? tp('actions.deactivate')
                                : tp('actions.activate')
                            }
                          >
                            <Power
                              className={
                                category.isActive
                                  ? 'h-4 w-4 text-green-600'
                                  : 'h-4 w-4 text-muted-foreground'
                              }
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setCategoryToDelete(category)}
                            disabled={inUse}
                            aria-label={tp('actions.deleteAria', { name: label })}
                            title={inUse ? tp('errors.inUse') : t('actions.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? tp('editTitle') : tp('newTitle')}</DialogTitle>
            <DialogDescription>
              {editingCategory ? tp('editDescription') : tp('newDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">{tp('nameLabel')}</Label>
              <Input
                id="categoryName"
                data-testid="expense-category-name"
                placeholder={tp('namePlaceholder')}
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                maxLength={100}
                autoFocus
              />
              {editingCategory && editingCategory.expenseCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {tp('renameHint', { count: editingCategory.expenseCount })}
                </p>
              )}
            </div>

            {editingCategory && (
              <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div>
                  <Label htmlFor="categoryActive">{tp('activeLabel')}</Label>
                  <p className="text-sm text-muted-foreground">{tp('activeHint')}</p>
                </div>
                <Switch
                  id="categoryActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !categoryName.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCategory ? tp('saveButton') : tp('createButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={categoryToDelete !== null}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tp('deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tp('deleteConfirm.description', {
                name: categoryToDelete ? labelForExpenseCategory(categoryToDelete.name, t) : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
