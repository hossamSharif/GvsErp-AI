'use client';

/**
 * Edit Item Page
 *
 * Page for viewing and editing an existing inventory item.
 */

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useItem, useUpdateItem } from '@/hooks/use-items';
import { ItemForm } from '@/components/forms/item-form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api-client';
import type { Category, UpdateItemInput } from '@erp/shared';
import { ArrowLeft, ArrowRightLeft } from 'lucide-react';

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
  const t = useTranslations('items.edit');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('items.errors');

  const translateApiError = (error: Error & { code?: string }, fallback: string) => {
    const code = error?.code;
    if (code) {
      try {
        return tErrors(code as 'DUPLICATE_SKU' | 'DUPLICATE_BARCODE' | 'ITEM_NOT_FOUND' | 'CATEGORY_NOT_FOUND');
      } catch {
        // unknown code — fall through
      }
    }
    return error?.message || fallback;
  };

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
        title: t('toasts.updated'),
        description: t('toasts.updatedDescription', { name: response.data.name }),
      });
      router.push(`/${locale}/items`);
    },
    onError: (error) => {
      toast({
        title: tCommon('error'),
        description: translateApiError(error, t('toasts.updateFailed')),
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const handleSubmit = useCallback(
    async (data: UpdateItemInput) => {
      try {
        await updateMutation.mutateAsync({ id: itemId, data });
      } catch {
        // Already surfaced via updateMutation's onError toast.
      }
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
          {itemError?.message || t('notFound')}
        </p>
        <Button onClick={() => router.push(`/${locale}/items`)}>
          {t('backToItems')}
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
          aria-label={t('backAriaLabel')}
          onClick={() => router.push(`/${locale}/items`)}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button
          variant="outline"
          className="gap-2 shrink-0"
          onClick={() => router.push(`/${locale}/items/${itemId}/movement`)}
        >
          <ArrowRightLeft className="h-4 w-4" />
          {t('viewMovement')}
        </Button>
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
