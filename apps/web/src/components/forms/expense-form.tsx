'use client';

/**
 * Expense Form
 *
 * Shared form for creating and editing expenses.
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus } from 'lucide-react';
import type { CreateExpenseInput, UpdateExpenseInput, ExpenseWithCreator } from '@erp/shared';
import { CurrencySelect } from '@/components/forms/currency-select';
import { useExpenseCategories, useCreateExpenseCategory } from '@/hooks/use-expenses';
import { labelForExpenseCategory } from '@/lib/expense-category-label';

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'check', 'credit_card', 'other'];
const NONE_VALUE = '__none__';
const NEW_CATEGORY_VALUE = '__new_category__';
const DEFAULT_CATEGORY = 'other';

export interface ExpenseFormProps {
  initialValues?: Partial<ExpenseWithCreator>;
  onSubmit: (data: CreateExpenseInput | UpdateExpenseInput) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode: 'create' | 'edit';
}

export function ExpenseForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode,
}: ExpenseFormProps) {
  const t = useTranslations('expenses');

  const today = new Date().toISOString().split('T')[0];

  const [category, setCategory] = useState(initialValues?.category || '');
  const [amount, setAmount] = useState<string>(
    initialValues?.amount !== undefined && initialValues.amount !== null
      ? String(initialValues.amount)
      : ''
  );
  const [currency, setCurrency] = useState(initialValues?.currency || 'USD');
  const [expenseDate, setExpenseDate] = useState(initialValues?.expenseDate || today);
  const [paymentMethod, setPaymentMethod] = useState<string>(
    initialValues?.paymentMethod || NONE_VALUE
  );
  const [description, setDescription] = useState(initialValues?.description || '');
  const [reference, setReference] = useState(initialValues?.reference || '');
  const [notes, setNotes] = useState(initialValues?.notes || '');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialValues) {
      setCategory(initialValues.category || '');
      setAmount(
        initialValues.amount !== undefined && initialValues.amount !== null
          ? String(initialValues.amount)
          : ''
      );
      setCurrency(initialValues.currency || 'USD');
      setExpenseDate(initialValues.expenseDate || today);
      setPaymentMethod(initialValues.paymentMethod || NONE_VALUE);
      setDescription(initialValues.description || '');
      setReference(initialValues.reference || '');
      setNotes(initialValues.notes || '');
    }
  }, [initialValues, today]);

  // Quick-add category dialog
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null);

  const { data: categoriesData } = useExpenseCategories();
  const createCategoryMutation = useCreateExpenseCategory({
    onSuccess: (data) => {
      setCategory(data.data.name);
      setNewCategoryOpen(false);
    },
    onError: (error) => {
      const code = (error as Error & { code?: string }).code;
      setNewCategoryError(
        code === 'CATEGORY_EXISTS'
          ? t('categoriesPage.errors.exists')
          : error.message || t('categoriesPage.toast.createError')
      );
    },
  });

  // Active categories, plus the expense's current one if it was deactivated
  const categoryOptions = useMemo(() => {
    const names = (categoriesData?.data ?? []).map((c) => c.name);
    if (initialValues?.category && !names.includes(initialValues.category)) {
      names.push(initialValues.category);
    }
    return names;
  }, [categoriesData, initialValues?.category]);

  // New expense: default to "other" when available, else the first category
  useEffect(() => {
    if (category || categoryOptions.length === 0) return;
    setCategory(
      categoryOptions.includes(DEFAULT_CATEGORY) ? DEFAULT_CATEGORY : categoryOptions[0]
    );
  }, [category, categoryOptions]);

  const handleCategoryChange = (value: string) => {
    if (value === NEW_CATEGORY_VALUE) {
      setNewCategoryName('');
      setNewCategoryError(null);
      setNewCategoryOpen(true);
      return;
    }
    setCategory(value);
  };

  const handleCreateCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setNewCategoryError(null);
    createCategoryMutation.mutate({ name });
  };

  const labelForCategory = (cat: string) => labelForExpenseCategory(cat, t);

  const labelForMethod = (m: string) => {
    if (PAYMENT_METHODS.includes(m)) return t(`methods.${m}` as never);
    return m;
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!category.trim()) {
      next.category = t('validation.categoryRequired');
    }
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      next.amount = t('validation.amountRequired');
    }
    if (!expenseDate) {
      next.expenseDate = t('validation.dateRequired');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: CreateExpenseInput | UpdateExpenseInput = {
      category: category.trim(),
      amount: Number(amount),
      currency,
      expenseDate,
      paymentMethod: paymentMethod === NONE_VALUE ? null : paymentMethod,
      description: description.trim() || null,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
    };

    await onSubmit(payload);
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {mode === 'create' ? t('newExpense') : t('editExpense')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">{t('fields.category')} *</Label>
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger id="category" data-testid="expense-category">
                  <SelectValue placeholder={t('placeholders.category')} />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {labelForCategory(c)}
                    </SelectItem>
                  ))}
                  <SelectItem
                    value={NEW_CATEGORY_VALUE}
                    className="text-primary"
                    data-testid="expense-category-new"
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      {t('placeholders.newCategory')}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category}</p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="expenseDate">{t('fields.date')} *</Label>
              <Input
                id="expenseDate"
                data-testid="expense-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
              {errors.expenseDate && (
                <p className="text-sm text-destructive">{errors.expenseDate}</p>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">{t('fields.amount')} *</Label>
              <Input
                id="amount"
                data-testid="expense-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder={t('placeholders.amount')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount}</p>
              )}
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency">{t('fields.currency')}</Label>
              <div data-testid="expense-currency">
                <CurrencySelect value={currency} onValueChange={setCurrency} />
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">{t('fields.paymentMethod')}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="paymentMethod" data-testid="expense-method">
                  <SelectValue placeholder={t('methods.unspecified')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>{t('methods.unspecified')}</SelectItem>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {labelForMethod(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <Label htmlFor="reference">{t('fields.reference')}</Label>
              <Input
                id="reference"
                data-testid="expense-reference"
                placeholder={t('placeholders.reference')}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('fields.description')}</Label>
            <Input
              id="description"
              data-testid="expense-description"
              placeholder={t('placeholders.description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">{t('fields.notes')}</Label>
            <Textarea
              id="notes"
              data-testid="expense-notes"
              placeholder={t('placeholders.notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t('actions.cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting} data-testid="expense-submit">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create'
            ? isSubmitting
              ? t('actions.creating')
              : t('actions.create')
            : isSubmitting
              ? t('actions.updating')
              : t('actions.update')}
        </Button>
      </div>
    </form>

    {/* Quick-add category (outside the <form> so its events don't submit the expense) */}
    <Dialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('categoriesPage.newTitle')}</DialogTitle>
          <DialogDescription>{t('categoriesPage.newDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="newCategoryName">{t('categoriesPage.nameLabel')}</Label>
          <Input
            id="newCategoryName"
            data-testid="expense-category-new-name"
            placeholder={t('categoriesPage.namePlaceholder')}
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateCategory();
              }
            }}
            maxLength={100}
            autoFocus
          />
          {newCategoryError && (
            <p className="text-sm text-destructive">{newCategoryError}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setNewCategoryOpen(false)}
            disabled={createCategoryMutation.isPending}
          >
            {t('actions.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleCreateCategory}
            disabled={createCategoryMutation.isPending || !newCategoryName.trim()}
          >
            {createCategoryMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t('categoriesPage.createButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
