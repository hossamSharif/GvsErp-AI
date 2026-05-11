'use client';

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ExpenseForm } from '@/components/forms/expense-form';
import { useCreateExpense } from '@/hooks/use-expenses';
import { useToast } from '@/components/ui/use-toast';
import type { CreateExpenseInput, UpdateExpenseInput } from '@erp/shared';

export default function NewExpensePage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const t = useTranslations('expenses');

  const createExpense = useCreateExpense({
    onSuccess: () => {
      toast({ title: t('toast.created'), description: t('toast.createdDesc') });
      router.push(`/${locale}/expenses`);
    },
    onError: (error) => {
      toast({
        title: t('toast.error'),
        description: error.message || t('toast.createError'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = useCallback(
    async (data: CreateExpenseInput | UpdateExpenseInput) => {
      await createExpense.mutateAsync(data as CreateExpenseInput);
    },
    [createExpense]
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
          <h1 className="text-2xl font-bold tracking-tight">{t('newExpense')}</h1>
          <p className="text-muted-foreground">{t('newExpenseDescription')}</p>
        </div>
      </div>

      <ExpenseForm
        mode="create"
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={createExpense.isPending}
      />
    </div>
  );
}
