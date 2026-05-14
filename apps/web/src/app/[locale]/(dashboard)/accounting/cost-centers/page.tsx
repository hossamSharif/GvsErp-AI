'use client';

/**
 * Cost Centers Page (Phase 7)
 *
 * Two-pane management screen: cost categories on the left (Department,
 * Project, Branch, …) and cost centers on the right (the actual units
 * within each category, e.g. "Engineering" under Department). Both are
 * created via inline dialogs.
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useCostCategories,
  useCostCenters,
  useCreateCostCategory,
  useCreateCostCenter,
} from '@/hooks/use-cost-centers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CostCentersPage() {
  const t = useTranslations('accounting.costCenters');
  const { toast } = useToast();

  const { data: categories = [], isLoading: catLoading } = useCostCategories();
  const { data: centers = [], isLoading: centerLoading } = useCostCenters();
  const createCategory = useCreateCostCategory();
  const createCenter = useCreateCostCenter();

  // Category create dialog
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catName, setCatName] = useState('');

  // Center create dialog
  const [centerDialogOpen, setCenterDialogOpen] = useState(false);
  const [centerForm, setCenterForm] = useState({
    category_id: '',
    code: '',
    name: '',
    parent_id: '__none__',
  });

  const activeCategories = useMemo(
    () => categories.filter((c) => c.is_active),
    [categories]
  );

  const handleCreateCategory = async () => {
    if (!catName.trim()) return;
    try {
      await createCategory.mutateAsync({ name: catName.trim() });
      toast({ title: t('toast.categoryCreated') });
      setCatDialogOpen(false);
      setCatName('');
    } catch (error) {
      toast({
        title: t('toast.error'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleCreateCenter = async () => {
    if (!centerForm.category_id || !centerForm.code.trim() || !centerForm.name.trim()) return;
    try {
      await createCenter.mutateAsync({
        category_id: centerForm.category_id,
        code: centerForm.code.trim(),
        name: centerForm.name.trim(),
        parent_id:
          centerForm.parent_id && centerForm.parent_id !== '__none__'
            ? centerForm.parent_id
            : undefined,
      });
      toast({ title: t('toast.centerCreated') });
      setCenterDialogOpen(false);
      setCenterForm({ category_id: '', code: '', name: '', parent_id: '__none__' });
    } catch (error) {
      toast({
        title: t('toast.error'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const centersInSelectedCategory = centers.filter(
    (c) => c.category_id === centerForm.category_id
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="h-6 w-6" /> {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Categories */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('categories.title')}</CardTitle>
                <CardDescription>{t('categories.description')}</CardDescription>
              </div>
              <Button size="sm" onClick={() => setCatDialogOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {catLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {t('categories.empty')}
              </p>
            ) : (
              <ul className="space-y-1">
                {categories.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between text-sm py-2 px-1"
                  >
                    <span className={c.is_active ? '' : 'text-muted-foreground line-through'}>
                      {c.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {centers.filter((ct) => ct.category_id === c.id).length} {t('categories.centersSuffix')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Centers */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('centers.title')}</CardTitle>
                <CardDescription>{t('centers.description')}</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setCenterDialogOpen(true)}
                disabled={activeCategories.length === 0}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('centers.add')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {centerLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : centers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                {activeCategories.length === 0
                  ? t('centers.emptyNeedsCategory')
                  : t('centers.empty')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('centers.columns.code')}</TableHead>
                    <TableHead>{t('centers.columns.name')}</TableHead>
                    <TableHead>{t('centers.columns.category')}</TableHead>
                    <TableHead>{t('centers.columns.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {centers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{c.code}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.category?.name ?? '-'}
                      </TableCell>
                      <TableCell>
                        {c.is_active ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                            {t('centers.status.active')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t('centers.status.inactive')}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category create dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('categories.dialog.title')}</DialogTitle>
            <DialogDescription>{t('categories.dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cc-cat-name">{t('categories.dialog.name')}</Label>
            <Input
              id="cc-cat-name"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder={t('categories.dialog.placeholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={!catName.trim() || createCategory.isPending}
            >
              {createCategory.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Center create dialog */}
      <Dialog open={centerDialogOpen} onOpenChange={setCenterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('centers.dialog.title')}</DialogTitle>
            <DialogDescription>{t('centers.dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('centers.dialog.category')}</Label>
              <Select
                value={centerForm.category_id}
                onValueChange={(v) =>
                  setCenterForm({ ...centerForm, category_id: v, parent_id: '__none__' })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('centers.dialog.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {activeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cc-code">{t('centers.dialog.code')}</Label>
                <Input
                  id="cc-code"
                  value={centerForm.code}
                  onChange={(e) =>
                    setCenterForm({ ...centerForm, code: e.target.value })
                  }
                  placeholder="ENG"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-name">{t('centers.dialog.name')}</Label>
                <Input
                  id="cc-name"
                  value={centerForm.name}
                  onChange={(e) =>
                    setCenterForm({ ...centerForm, name: e.target.value })
                  }
                  placeholder={t('centers.dialog.namePlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('centers.dialog.parent')}</Label>
              <Select
                value={centerForm.parent_id}
                onValueChange={(v) =>
                  setCenterForm({ ...centerForm, parent_id: v })
                }
                disabled={!centerForm.category_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('centers.dialog.parentPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t('centers.dialog.parentNone')}
                  </SelectItem>
                  {centersInSelectedCategory.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-mono text-xs mr-2">{c.code}</span>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCenterDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreateCenter}
              disabled={
                !centerForm.category_id ||
                !centerForm.code.trim() ||
                !centerForm.name.trim() ||
                createCenter.isPending
              }
            >
              {createCenter.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
