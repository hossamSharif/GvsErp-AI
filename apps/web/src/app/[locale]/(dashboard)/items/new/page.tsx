'use client';

/**
 * New Item Page
 *
 * Page for creating a new inventory item.
 */

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCreateItem } from '@/hooks/use-items';
import { ItemForm } from '@/components/forms/item-form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api-client';
import type { Category, CreateItemInput } from '@erp-saas/shared';
import { ArrowLeft } from 'lucide-react';

interface CategoriesResponse {
  success: boolean;
  data: Category[];
}

export default function NewItemPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const t = useTranslations('items');

  // Fetch categories for the form
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get<CategoriesResponse>('/categories');
      return response;
    },
  });

  // Create mutation
  const createMutation = useCreateItem({
    onSuccess: (response) => {
      toast({
        title: t('messages.itemCreated'),
        description: t('messages.itemCreatedSuccess', { name: response.data.name }),
      });
      router.push(`/${locale}/items`);
    },
    onError: (error) => {
      toast({
        title: t('messages.error'),
        description: error.message || t('messages.createError'),
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const handleSubmit = useCallback(
    async (data: CreateItemInput) => {
      await createMutation.mutateAsync(data);
    },
    [createMutation]
  );

  // Handle cancel
  const handleCancel = useCallback(() => {
    router.push(`/${locale}/items`);
  }, [router, locale]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/items`)}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('newItem')}</h1>
          <p className="text-muted-foreground">
            {t('newItemDescription')}
          </p>
        </div>
      </div>

      {/* Item Form */}
      <ItemForm
        categories={categoriesData?.data || []}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={createMutation.isPending}
        mode="create"
      />
    </div>
  );
}
