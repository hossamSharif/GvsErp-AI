'use client';

/**
 * Expense Form Component
 * Form for creating and editing expenses
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useExpenseCategories } from '@/hooks/use-expenses';
import { Expense } from '@erp-saas/shared/types/expenses';
import { Loader2 } from 'lucide-react';

// Form validation schema
const expenseFormSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  currency: z.string().length(3).toUpperCase().optional(),
  exchange_rate: z.coerce.number().positive().optional(),
  description: z.string().max(1000).optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

interface ExpenseFormProps {
  expense?: Expense;
  onSubmit: (data: ExpenseFormValues) => void;
  isSubmitting?: boolean;
}

export function ExpenseForm({ expense, onSubmit, isSubmitting }: ExpenseFormProps) {
  const { data: categoriesData, isLoading: categoriesLoading } =
    useExpenseCategories();

  const categories = categoriesData?.data || [];

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      category_id: expense?.category_id || undefined,
      amount: expense?.amount || 0,
      currency: expense?.currency || 'USD',
      exchange_rate: expense?.exchange_rate || 1.0,
      description: expense?.description || '',
      expense_date: expense?.expense_date || new Date().toISOString().split('T')[0],
    },
  });

  const handleSubmit = (data: ExpenseFormValues) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Expense Date */}
        <FormField
          control={form.control}
          name="expense_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expense Date *</FormLabel>
              <FormControl>
                <Input type="date" {...field} max={new Date().toISOString().split('T')[0]} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Amount */}
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Currency */}
        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Currency</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="USD"
                  maxLength={3}
                  {...field}
                  value={field.value || 'USD'}
                />
              </FormControl>
              <FormDescription>3-letter currency code (e.g., USD, EUR)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Exchange Rate */}
        <FormField
          control={form.control}
          name="exchange_rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Exchange Rate</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.000001"
                  min="0"
                  placeholder="1.0"
                  {...field}
                  value={field.value || 1.0}
                />
              </FormControl>
              <FormDescription>
                Exchange rate to base currency (default: 1.0)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Category */}
        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || undefined}
                disabled={categoriesLoading}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category (optional)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">No Category</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter expense description (optional)"
                  className="resize-none"
                  rows={4}
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormDescription>
                Optional notes about this expense
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {expense ? 'Update Expense' : 'Create Expense'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
