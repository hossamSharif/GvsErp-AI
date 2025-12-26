'use client';

/**
 * New Expense Page
 * Page for creating a new expense
 */

import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExpenseForm } from '@/components/forms/expense-form';
import { useCreateExpense } from '@/hooks/use-expenses';
import { useToast } from '@/hooks/use-toast';
import { CreateExpenseRequest } from '@erp-saas/shared/types/expenses';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NewExpensePage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string || 'en';
  const { toast } = useToast();
  const createExpenseMutation = useCreateExpense();

  const handleSubmit = async (data: CreateExpenseRequest) => {
    try {
      await createExpenseMutation.mutateAsync(data);

      toast({
        title: 'Success',
        description: 'Expense created successfully',
      });

      router.push(`/${locale}/expenses`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create expense',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Expense</h1>
          <p className="text-muted-foreground">Create a new business expense</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseForm
            onSubmit={handleSubmit}
            isSubmitting={createExpenseMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
