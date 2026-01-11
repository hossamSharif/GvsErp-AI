'use client';

/**
 * Expense Categories Management Page
 * Manage expense categories and subcategories
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useExpenseCategories,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
} from '@/hooks/use-expenses';
import { useToast } from '@/hooks/use-toast';
import {
  ExpenseCategory,
  CreateExpenseCategoryRequest,
  UpdateExpenseCategoryRequest,
} from '@erp-saas/shared/src/types/expenses';

export default function ExpenseCategoriesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('expenses');

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editCategoryName, setEditCategoryName] = useState('');

  const { data: categoriesData, isLoading } = useExpenseCategories();
  const createCategoryMutation = useCreateExpenseCategory();
  const updateCategoryMutation = useUpdateExpenseCategory();
  const deleteCategoryMutation = useDeleteExpenseCategory();

  const categories = categoriesData?.data || [];

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: t('error'),
        description: t('categories.categoryNameRequired'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const data: CreateExpenseCategoryRequest = {
        name: newCategoryName.trim(),
      };

      await createCategoryMutation.mutateAsync(data);

      toast({
        title: t('success'),
        description: t('categories.categoryCreated'),
      });

      setNewCategoryName('');
      setIsCreateDialogOpen(false);
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message || t('categories.createError'),
        variant: 'destructive',
      });
    }
  };

  const handleEditCategory = async () => {
    if (!editingCategory || !editCategoryName.trim()) {
      toast({
        title: t('error'),
        description: t('categories.categoryNameRequired'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const data: UpdateExpenseCategoryRequest = {
        name: editCategoryName.trim(),
      };

      await updateCategoryMutation.mutateAsync({
        id: editingCategory.id,
        data,
      });

      toast({
        title: t('success'),
        description: t('categories.categoryUpdated'),
      });

      setEditingCategory(null);
      setEditCategoryName('');
      setIsEditDialogOpen(false);
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message || t('categories.updateError'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(t('categories.confirmDeleteCategory'))) {
      return;
    }

    try {
      await deleteCategoryMutation.mutateAsync(id);

      toast({
        title: t('success'),
        description: t('categories.categoryDeleted'),
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message || t('categories.deleteError'),
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setEditCategoryName(category.name);
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t('categories.title')}</h1>
            <p className="text-muted-foreground">
              {t('categories.subtitle')}
            </p>
          </div>
        </div>

        {/* Create Category Button */}
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t('categories.newCategory')}
        </Button>

        {/* Create Category Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('categories.createDialogTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="category-name">{t('categories.categoryName')}</Label>
                <Input
                  id="category-name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t('categories.categoryNamePlaceholder')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateCategory();
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewCategoryName('');
                    setIsCreateDialogOpen(false);
                  }}
                >
                  {t('categories.cancel')}
                </Button>
                <Button
                  onClick={handleCreateCategory}
                  disabled={createCategoryMutation.isPending}
                >
                  {t('categories.create')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Category Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('categories.editDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor="edit-category-name">{t('categories.categoryName')}</Label>
              <Input
                id="edit-category-name"
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                placeholder={t('categories.categoryNamePlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleEditCategory();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingCategory(null);
                  setEditCategoryName('');
                  setIsEditDialogOpen(false);
                }}
              >
                {t('categories.cancel')}
              </Button>
              <Button
                onClick={handleEditCategory}
                disabled={updateCategoryMutation.isPending}
              >
                {t('categories.update')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('categories.categoriesCount')} ({categories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">
              {t('categories.loadingCategories')}
            </p>
          ) : categories.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t('categories.noCategories')}
            </p>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <h3 className="font-medium">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('categories.createdAt')} {new Date(category.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(category)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(category.id)}
                      disabled={deleteCategoryMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
