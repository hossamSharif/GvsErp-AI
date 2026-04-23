'use client';

/**
 * Category Management Page
 *
 * Page for managing item categories with:
 * - Tree view of categories
 * - Add/Edit/Delete operations
 * - Drag-drop reordering (future)
 */

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  useCategories,
  useCategoryTree,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/hooks/use-categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import type { Category, CategoryWithChildren } from '@erp/shared';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Loader2,
} from 'lucide-react';

// =============================================================================
// CATEGORY TREE ITEM COMPONENT
// =============================================================================

interface CategoryTreeItemProps {
  category: CategoryWithChildren;
  level: number;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onAddChild: (parentId: string) => void;
}

function CategoryTreeItem({
  category,
  level,
  onEdit,
  onDelete,
  onAddChild,
}: CategoryTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const hasChildren = category.children && category.children.length > 0;
  const tActions = useTranslations('items.categories.itemActions');

  return (
    <div className="select-none">
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 group',
          'transition-colors'
        )}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        {/* Expand/Collapse Button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={
            isExpanded
              ? tActions('collapse', { name: category.name })
              : tActions('expand', { name: category.name })
          }
          className={cn(
            'p-0.5 rounded hover:bg-muted',
            !hasChildren && 'invisible'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Folder Icon */}
        {isExpanded && hasChildren ? (
          <FolderOpen className="h-4 w-4 text-primary" />
        ) : (
          <Folder className="h-4 w-4 text-muted-foreground" />
        )}

        {/* Category Name */}
        <span className="flex-1 truncate">{category.name}</span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onAddChild(category.id)}
            aria-label={tActions('addSubcategoryAria', { name: category.name })}
            title={tActions('addSubcategory')}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(category)}
            aria-label={tActions('editAria', { name: category.name })}
            title={tActions('edit')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => onDelete(category)}
            aria-label={tActions('deleteAria', { name: category.name })}
            title={tActions('delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {category.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function CategoriesPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const t = useTranslations('items.categories');
  const tCommon = useTranslations('common');

  // UI State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  // Queries
  const { data: treeData, isLoading } = useCategoryTree();
  const { data: flatData } = useCategories();

  // Mutations
  const createMutation = useCreateCategory({
    onSuccess: () => {
      toast({ title: t('toasts.created'), description: t('toasts.createdDescription') });
      closeDialog();
    },
    onError: (error) => {
      toast({
        title: tCommon('error'),
        description: error.message || t('toasts.createFailed'),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useUpdateCategory({
    onSuccess: () => {
      toast({ title: t('toasts.updated'), description: t('toasts.updatedDescription') });
      closeDialog();
    },
    onError: (error) => {
      toast({
        title: tCommon('error'),
        description: error.message || t('toasts.updateFailed'),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useDeleteCategory({
    onSuccess: () => {
      toast({ title: t('toasts.deleted'), description: t('toasts.deletedDescription') });
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    },
    onError: (error) => {
      toast({
        title: tCommon('error'),
        description: error.message || t('toasts.deleteFailed'),
        variant: 'destructive',
      });
    },
  });

  // Handlers
  const openCreateDialog = useCallback((parentId: string | null = null) => {
    setEditingCategory(null);
    setParentId(parentId);
    setCategoryName('');
    setSelectedParentId(parentId);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setSelectedParentId(category.parentId);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingCategory(null);
    setCategoryName('');
    setSelectedParentId(null);
    setParentId(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!categoryName.trim()) return;

    if (editingCategory) {
      await updateMutation.mutateAsync({
        id: editingCategory.id,
        data: {
          name: categoryName.trim(),
          parentId: selectedParentId,
        },
      });
    } else {
      await createMutation.mutateAsync({
        name: categoryName.trim(),
        parentId: selectedParentId,
      });
    }
  }, [categoryName, editingCategory, selectedParentId, createMutation, updateMutation]);

  const handleDelete = useCallback((category: Category) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (categoryToDelete) {
      await deleteMutation.mutateAsync(categoryToDelete.id);
    }
  }, [categoryToDelete, deleteMutation]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/items`)}
            aria-label={t('backAriaLabel')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <Button onClick={() => openCreateDialog(null)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addButton')}
        </Button>
      </div>

      {/* Category Tree */}
      <Card>
        <CardHeader>
          <CardTitle>{t('treeTitle')}</CardTitle>
          <CardDescription>{t('treeDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !treeData?.data || treeData.data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Folder className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>{t('emptyTitle')}</p>
              <p className="text-sm">{t('emptyHint')}</p>
            </div>
          ) : (
            <div className="border rounded-md">
              {treeData.data.map((category) => (
                <CategoryTreeItem
                  key={category.id}
                  category={category}
                  level={0}
                  onEdit={openEditDialog}
                  onDelete={handleDelete}
                  onAddChild={openCreateDialog}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t('editTitle') : t('newTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingCategory ? t('editDescription') : t('newDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Category Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{t('nameLabel')}</Label>
              <Input
                id="name"
                placeholder={t('namePlaceholder')}
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Parent Category */}
            <div className="space-y-2">
              <Label htmlFor="parent">{t('parentLabel')}</Label>
              <Select
                value={selectedParentId || 'none'}
                onValueChange={(value) =>
                  setSelectedParentId(value === 'none' ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('parentPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('parentNone')}</SelectItem>
                  {flatData?.data
                    ?.filter((cat) => cat.id !== editingCategory?.id)
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              {t('cancelButton')}
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !categoryName.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tCommon('saving')}
                </>
              ) : editingCategory ? (
                t('saveButton')
              ) : (
                t('createButton')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description', { name: categoryToDelete?.name ?? '' })}
              <br />
              <br />
              <strong>{t('deleteDialog.note')}</strong>{' '}
              {t('deleteDialog.noteBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? tCommon('deleting') : tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
