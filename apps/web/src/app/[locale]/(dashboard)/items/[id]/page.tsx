'use client';

/**
 * Edit Item Page
 *
 * Page for viewing and editing an existing inventory item.
 */

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useItem, useUpdateItem } from '@/hooks/use-items';
import { ItemForm } from '@/components/forms/item-form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api-client';
import type { Category, UpdateItemInput } from '@erp/shared';
import { ArrowLeft } from 'lucide-react';

interface CategoriesResponse {
  success: boolean;
  data: Category[];
}

export default function EditItemPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const itemId = params.id as string;
  const { toast } = useToast();

  // Fetch item data
  const {
    data: itemData,
    isLoading: isItemLoading,
    error: itemError,
  } = useItem(itemId);

  // Fetch categories for the form
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get<CategoriesResponse>('/categories');
      return response;
    },
  });

  // Update mutation
  const updateMutation = useUpdateItem({
    onSuccess: (response) => {
      toast({
        title: 'Item updated',
        description: `${response.data.name} has been updated successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update item',
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const handleSubmit = useCallback(
    async (data: UpdateItemInput) => {
      await updateMutation.mutateAsync({ id: itemId, data });
    },
    [updateMutation, itemId]
  );

  // Handle cancel
  const handleCancel = useCallback(() => {
    router.push(`/${locale}/items`);
  }, [router, locale]);

  // Loading state
  if (isItemLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (itemError || !itemData?.data) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <p className="text-destructive">
          {itemError?.message || 'Item not found'}
        </p>
        <Button onClick={() => router.push(`/${locale}/items`)}>
          Back to Items
        </Button>
      </div>
    );
  }

  const item = itemData.data;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Go back to items"
          onClick={() => router.push(`/${locale}/items`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
          <p className="text-muted-foreground">
            Edit item details, pricing, and packaging options.
          </p>
        </div>
      </div>

      {/* Item Form */}
      <ItemForm
        item={item}
        categories={categoriesData?.data || []}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={updateMutation.isPending}
        mode="edit"
      />
    </div>
  );
}
