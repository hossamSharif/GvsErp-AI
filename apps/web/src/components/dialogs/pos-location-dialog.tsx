'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useActiveWarehouses } from '@/hooks/use-warehouses';
import {
  useCreatePOSLocation,
  useUpdatePOSLocation,
} from '@/hooks/use-pos';
import type { POSLocationWithWarehouse } from '@erp/shared';

const schema = z.object({
  name: z.string().min(1).max(255).trim(),
  warehouseId: z.string().uuid(),
  taxRate: z
    .number()
    .min(0)
    .max(100)
    .or(z.nan())
    .transform((v) => (Number.isNaN(v) ? 0 : v)),
  isActive: z.boolean().default(true),
});

type FormValues = z.input<typeof schema>;

interface POSLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: POSLocationWithWarehouse | null;
}

export function POSLocationDialog({
  open,
  onOpenChange,
  location,
}: POSLocationDialogProps) {
  const t = useTranslations('pos');
  const { toast } = useToast();
  const isEdit = !!location;

  const { data: warehousesResponse } = useActiveWarehouses();
  const warehouses = warehousesResponse?.data ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      warehouseId: '',
      taxRate: 0,
      isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (location) {
        form.reset({
          name: location.name,
          warehouseId: location.warehouse_id,
          taxRate: location.settings?.tax?.default_rate ?? 0,
          isActive: location.is_active,
        });
      } else {
        form.reset({
          name: '',
          warehouseId: '',
          taxRate: 0,
          isActive: true,
        });
      }
    }
  }, [open, location, form]);

  const createMutation = useCreatePOSLocation({
    onSuccess: () => {
      toast({ title: t('createSuccess') });
      onOpenChange(false);
    },
    onError: (err) => {
      toast({
        title: t('createError'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useUpdatePOSLocation({
    onSuccess: () => {
      toast({ title: t('updateSuccess') });
      onOpenChange(false);
    },
    onError: (err) => {
      toast({
        title: t('updateError'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const submitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: FormValues) => {
    const payload = {
      name: values.name.trim(),
      warehouse_id: values.warehouseId,
      settings: {
        tax: { default_rate: Number(values.taxRate) || 0 },
      },
    };

    if (isEdit && location) {
      updateMutation.mutate({
        id: location.id,
        data: { ...payload, is_active: values.isActive },
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  const noWarehouses = warehouses.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('editLocation') : t('createLocation')}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t('editLocationDescription')
              : t('createLocationDescription')}
          </DialogDescription>
        </DialogHeader>

        {noWarehouses ? (
          <div className="rounded-md border p-4 text-sm">
            <p className="font-medium">{t('noWarehousesTitle')}</p>
            <p className="text-muted-foreground">
              {t('noWarehousesDescription')}
            </p>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('namePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('warehouse')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('warehousePlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {warehouses.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('taxRate')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        {...field}
                        value={field.value as number}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ''
                              ? 0
                              : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>{t('taxRateDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isEdit && (
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <FormLabel className="text-base">{t('active')}</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? isEdit
                      ? t('saving')
                      : t('creating')
                    : isEdit
                      ? t('save')
                      : t('create')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
