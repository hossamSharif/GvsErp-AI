'use client';

/**
 * Expense Form
 *
 * Shared form for creating and editing expenses.
 */

import { useState, useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';
import type { CreateExpenseInput, UpdateExpenseInput, ExpenseWithCreator } from '@erp/shared';
import { EXPENSE_CATEGORY_VALUES } from '@erp/shared';

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'check', 'credit_card', 'other'];
const NONE_VALUE = '__none__';

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

  const [category, setCategory] = useState(initialValues?.category || 'other');
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
      setCategory(initialValues.category || 'other');
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

  const labelForCategory = (cat: string) => {
    const known = EXPENSE_CATEGORY_VALUES as readonly string[];
    if (known.includes(cat)) return t(`categories.${cat}` as never);
    return cat;
  };

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
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category" data-testid="expense-category">
                  <SelectValue placeholder={t('placeholders.category')} />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORY_VALUES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {labelForCategory(c)}
                    </SelectItem>
                  ))}
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
              <Input
                id="currency"
                data-testid="expense-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
              />
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
  );
}
