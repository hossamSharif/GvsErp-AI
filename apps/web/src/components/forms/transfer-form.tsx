'use client';

/**
 * Transfer Form Component
 *
 * Form for creating and editing stock transfers between warehouses.
 */

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useActiveWarehouses } from '@/hooks/use-warehouses';
import { useItems } from '@/hooks/use-items';
import type { Warehouse, CreateTransferInput } from '@erp/shared';

// Form validation schema
const transferFormSchema = z.object({
  fromWarehouseId: z.string().min(1, 'Source warehouse is required'),
  toWarehouseId: z.string().min(1, 'Destination warehouse is required'),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Item is required'),
        quantity: z.coerce.number().positive('Quantity must be greater than 0'),
      })
    )
    .min(1, 'At least one item is required'),
}).refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
  message: 'Source and destination warehouses must be different',
  path: ['toWarehouseId'],
});

type TransferFormValues = z.infer<typeof transferFormSchema>;

interface TransferFormProps {
  initialFromWarehouseId?: string;
  initialToWarehouseId?: string;
  onSubmit: (data: CreateTransferInput) => Promise<void>;
  isSubmitting?: boolean;
}

export function TransferForm({
  initialFromWarehouseId,
  initialToWarehouseId,
  onSubmit,
  isSubmitting = false,
}: TransferFormProps) {
  const t = useTranslations('transfers');
  const [itemSearch, setItemSearch] = useState('');

  const { data: warehousesData } = useActiveWarehouses();
  const { data: itemsData } = useItems({ search: itemSearch, limit: 50 });

  const warehouses = warehousesData?.data || [];
  const items = itemsData?.data || [];

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      fromWarehouseId: initialFromWarehouseId || '',
      toWarehouseId: initialToWarehouseId || '',
      notes: '',
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const fromWarehouseId = form.watch('fromWarehouseId');

  const handleAddItem = () => {
    append({ itemId: '', quantity: 1 });
  };

  const handleSubmit = async (values: TransferFormValues) => {
    await onSubmit({
      fromWarehouseId: values.fromWarehouseId,
      toWarehouseId: values.toWarehouseId,
      notes: values.notes || null,
      items: values.items.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
      })),
    });
  };

  const getItemName = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    return item?.name || '';
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Warehouse Selection */}
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="fromWarehouseId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fromWarehouse')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectSourceWarehouse')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {warehouses.map((warehouse: Warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>{t('fromWarehouseDescription')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="toWarehouseId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('toWarehouse')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectDestinationWarehouse')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {warehouses
                      .filter((w: Warehouse) => w.id !== fromWarehouseId)
                      .map((warehouse: Warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FormDescription>{t('toWarehouseDescription')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t('itemsToTransfer')}
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addItem')}
            </Button>
          </CardHeader>
          <CardContent>
            {fields.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {t('noItemsAdded')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%]">{t('item')}</TableHead>
                    <TableHead>{t('quantity')}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.itemId`}
                          render={({ field }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('selectItem')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <div className="p-2">
                                    <Input
                                      placeholder={t('searchItems')}
                                      value={itemSearch}
                                      onChange={(e) => setItemSearch(e.target.value)}
                                      className="mb-2"
                                    />
                                  </div>
                                  {items.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.name}
                                      {item.sku && ` (${item.sku})`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0.001"
                                  step="0.001"
                                  placeholder="e.g. 10"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove transfer item"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {form.formState.errors.items?.root && (
              <p className="text-sm text-destructive mt-2">
                {form.formState.errors.items.root.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('notes')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('notesPlaceholder')}
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormDescription>{t('notesDescription')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('creating') : t('createTransfer')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
