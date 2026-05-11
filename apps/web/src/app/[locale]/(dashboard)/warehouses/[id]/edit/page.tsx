'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';

import { useWarehouse, useUpdateWarehouse } from '@/hooks/use-warehouses';

const editWarehouseSchema = z.object({
  name: z.string().min(1, 'Warehouse name is required').max(255),
  address: z.string().max(500).optional(),
  isActive: z.boolean(),
});

type EditWarehouseFormValues = z.infer<typeof editWarehouseSchema>;

export default function EditWarehousePage() {
  const t = useTranslations('warehouses');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const warehouseId = params.id as string;
  const { toast } = useToast();

  const { data: warehouseResponse, isLoading, error } = useWarehouse(warehouseId);

  const form = useForm<EditWarehouseFormValues>({
    resolver: zodResolver(editWarehouseSchema),
    defaultValues: { name: '', address: '', isActive: true },
  });

  useEffect(() => {
    if (warehouseResponse?.data) {
      form.reset({
        name: warehouseResponse.data.name,
        address: warehouseResponse.data.address ?? '',
        isActive: warehouseResponse.data.isActive,
      });
    }
  }, [warehouseResponse, form]);

  const updateMutation = useUpdateWarehouse({
    onSuccess: (response) => {
      toast({
        title: t('warehouseUpdated'),
        description: response.data.name,
      });
      router.push(`/${locale}/warehouses/${warehouseId}`);
    },
    onError: (err) => {
      toast({
        title: t('errorLoading'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (values: EditWarehouseFormValues) => {
    await updateMutation.mutateAsync({
      id: warehouseId,
      data: {
        name: values.name,
        address: values.address || null,
        isActive: values.isActive,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !warehouseResponse?.data) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4 p-8">
        <p className="text-destructive">{error?.message || t('warehouseNotFound')}</p>
        <Button onClick={() => router.push(`/${locale}/warehouses`)}>{t('backToWarehouses')}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('backToWarehouses')}
          onClick={() => router.push(`/${locale}/warehouses/${warehouseId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('editWarehouse')}</h1>
          <p className="text-muted-foreground">{t('editWarehouseDescription')}</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t('editWarehouse')}</CardTitle>
          <CardDescription>{t('editWarehouseDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('warehouseNamePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('address')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('addressPlaceholder')}
                        rows={3}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>{t('addressDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t('active')}</FormLabel>
                      <FormDescription>{t('activeDescription')}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/${locale}/warehouses/${warehouseId}`)}
                >
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? t('saving') : t('save')}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
