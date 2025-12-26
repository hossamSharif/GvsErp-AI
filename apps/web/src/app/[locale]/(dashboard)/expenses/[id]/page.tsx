'use client';

/**
 * Expense Edit Page
 * Page for viewing and editing an existing expense
 */

import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExpenseForm } from '@/components/forms/expense-form';
import { useExpense, useUpdateExpense } from '@/hooks/use-expenses';
import { useToast } from '@/hooks/use-toast';
import { UpdateExpenseRequest } from '@erp-saas/shared/types/expenses';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ExpenseEditPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string || 'en';
  const expenseId = params.id as string;
  const { toast } = useToast();

  const { data: expenseResponse, isLoading, error } = useExpense(expenseId);
  const expense = expenseResponse?.data || expenseResponse;
  const updateExpenseMutation = useUpdateExpense();

  const handleSubmit = async (data: UpdateExpenseRequest) => {
    try {
      await updateExpenseMutation.mutateAsync({ id: expenseId, data });

      toast({
        title: 'Success',
        description: 'Expense updated successfully',
      });

      router.push(`/${locale}/expenses`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update expense',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="space-y-6 p-8">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">Expense not found or failed to load.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push(`/${locale}/expenses`)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Expenses
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Expense</h1>
          <p className="text-muted-foreground">Update expense details</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseForm
            expense={expense}
            onSubmit={handleSubmit}
            isSubmitting={updateExpenseMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
