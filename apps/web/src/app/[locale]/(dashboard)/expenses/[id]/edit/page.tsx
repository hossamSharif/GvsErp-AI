'use client';

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ExpenseForm } from '@/components/forms/expense-form';
import { useExpense, useUpdateExpense } from '@/hooks/use-expenses';
import { useToast } from '@/components/ui/use-toast';
import type { CreateExpenseInput, UpdateExpenseInput } from '@erp/shared';

export default function EditExpensePage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const id = params.id as string;
  const { toast } = useToast();
  const t = useTranslations('expenses');

  const { data, isLoading, error } = useExpense(id);
  const expense = data?.data;

  const updateExpense = useUpdateExpense({
    onSuccess: () => {
      toast({ title: t('toast.updated'), description: t('toast.updatedDesc') });
      router.push(`/${locale}/expenses`);
    },
    onError: (err) => {
      toast({
        title: t('toast.error'),
        description: err.message || t('toast.updateError'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = useCallback(
    async (data: CreateExpenseInput | UpdateExpenseInput) => {
      await updateExpense.mutateAsync({ id, input: data as UpdateExpenseInput });
    },
    [updateExpense, id]
  );

  const handleCancel = useCallback(() => {
    router.push(`/${locale}/expenses`);
  }, [router, locale]);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Go back">
          <Link href={`/${locale}/expenses`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('editExpense')}</h1>
          <p className="text-muted-foreground">{t('editExpenseDescription')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error || !expense ? (
        <p className="text-destructive">{error?.message || 'Expense not found'}</p>
      ) : (
        <ExpenseForm
          mode="edit"
          initialValues={expense}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={updateExpense.isPending}
        />
      )}
    </div>
  );
}
