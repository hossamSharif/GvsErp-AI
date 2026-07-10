'use client';

/**
 * Item Quick Modal
 *
 * A compact, tab-less create/edit dialog for items — used from the invoice
 * quick-add bar and the items list page so users can add or fix an item
 * without leaving what they were doing. Only the essentials are exposed
 * (name, alternative name, barcode, expiry tracking, prices); everything else is submitted
 * at the same defaults ItemForm uses. Packaging and images are out of scope
 * here — use the full item page for those.
 */

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CurrencySelect } from '@/components/forms/currency-select';
import { useOnline } from '@/hooks/use-online';
import {
  useCreateItem,
  useUpdateItem,
  useAddItemPrice,
  useUpdateItemPrice,
  useDeleteItemPrice,
} from '@/hooks/use-items';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Loader2, Save, WifiOff } from 'lucide-react';
import type { ItemWithRelations } from '@erp/shared';

const TIER_KEYS = ['retail', 'wholesale', 'vip', 'cost'] as const;

type ValidationMessages = {
  nameRequired: string;
  priceTierRequired: string;
  pricePositive: string;
  nameMaxLength: string;
  barcodeMaxLength: string;
  expiryDateRequired: string;
};

function createQuickItemSchema(messages: ValidationMessages) {
  const priceSchema = z.object({
    id: z.string().optional(),
    priceTier: z.string().min(1, messages.priceTierRequired),
    price: z.coerce.number().min(0, messages.pricePositive),
    currency: z.string().default('USD'),
  });

  return z.object({
    name: z.string().min(1, messages.nameRequired).max(255, messages.nameMaxLength),
    nameAlias: z.string().max(255, messages.nameMaxLength).nullable().optional(),
    barcode: z.string().max(100, messages.barcodeMaxLength).nullable().optional(),
    tracksExpiry: z.boolean().default(false),
    expiryDate: z.string().nullable().optional(),
    prices: z.array(priceSchema).default([]),
  }).refine(
    (data) => !data.tracksExpiry || !!data.expiryDate,
    { message: messages.expiryDateRequired, path: ['expiryDate'] }
  );
}

type QuickItemFormData = z.infer<ReturnType<typeof createQuickItemSchema>>;

interface ItemQuickModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** Required when mode === 'edit'. */
  item?: ItemWithRelations | null;
  onSaved: (item: ItemWithRelations) => void;
}

export function ItemQuickModal({ open, onOpenChange, mode, item, onSaved }: ItemQuickModalProps) {
  const t = useTranslations('items.form');
  const tFields = useTranslations('items.form.fields');
  const tPricing = useTranslations('items.form.pricing');
  const tModal = useTranslations('items.quickModal');
  const tTiers = useTranslations('items.priceTiers');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const online = useOnline();

  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const addPrice = useAddItemPrice();
  const updatePrice = useUpdateItemPrice();
  const deletePrice = useDeleteItemPrice();

  const schema = createQuickItemSchema({
    nameRequired: t('validation.nameRequired'),
    priceTierRequired: t('validation.priceTierRequired'),
    pricePositive: t('validation.pricePositive'),
    nameMaxLength: t('validation.nameMaxLength'),
    barcodeMaxLength: t('validation.barcodeMaxLength'),
    expiryDateRequired: t('validation.expiryDateRequired'),
  });

  const form = useForm<QuickItemFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      nameAlias: '',
      barcode: '',
      tracksExpiry: false,
      expiryDate: null,
      prices: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'prices',
  });

  // Reset the form whenever the modal opens (fresh create, or the item being edited).
  useEffect(() => {
    if (!open) return;
    form.reset({
      name: item?.name ?? '',
      nameAlias: item?.nameAlias ?? '',
      barcode: item?.barcode ?? '',
      tracksExpiry: item?.tracksExpiry ?? false,
      expiryDate: item?.expiryDate || null,
      prices:
        item?.prices?.map((p) => ({
          id: p.id,
          priceTier: p.priceTier,
          price: p.price,
          currency: p.currency,
        })) ?? [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const isSaving =
    createItem.isPending || updateItem.isPending || addPrice.isPending || updatePrice.isPending || deletePrice.isPending;

  const handleSubmit = async (data: QuickItemFormData) => {
    const payload = {
      name: data.name,
      nameAlias: data.nameAlias || null,
      barcode: data.barcode || null,
      tracksExpiry: data.tracksExpiry,
      expiryDate: data.tracksExpiry ? data.expiryDate || null : null,
    };

    try {
      if (mode === 'create') {
        const created = await createItem.mutateAsync({
          ...payload,
          prices: data.prices.map((p) => ({
            priceTier: p.priceTier,
            price: p.price,
            currency: p.currency,
          })),
        });
        toast({
          title: tModal('toasts.created'),
          description: tModal('toasts.createdDescription', { name: created.data.name }),
        });
        onSaved(created.data);
      } else if (item) {
        const updated = await updateItem.mutateAsync({ id: item.id, data: payload });

        // Reconcile prices: update existing rows, add new rows, delete removed rows.
        const originalIds = new Set(item.prices.map((p) => p.id));
        const remainingIds = new Set(data.prices.filter((p) => p.id).map((p) => p.id as string));

        await Promise.all([
          ...data.prices.map((p) =>
            p.id
              ? updatePrice.mutateAsync({
                  itemId: item.id,
                  priceId: p.id,
                  data: { priceTier: p.priceTier, price: p.price, currency: p.currency },
                })
              : addPrice.mutateAsync({
                  itemId: item.id,
                  data: { priceTier: p.priceTier, price: p.price, currency: p.currency },
                })
          ),
          ...Array.from(originalIds)
            .filter((id) => !remainingIds.has(id))
            .map((priceId) => deletePrice.mutateAsync({ itemId: item.id, priceId })),
        ]);

        const finalPrices = data.prices.map((p, idx) => ({
          id: p.id ?? `pending-${idx}`,
          itemId: item.id,
          tenantId: item.tenantId,
          priceTier: p.priceTier,
          price: p.price,
          currency: p.currency,
          effectiveFrom: null,
          effectiveTo: null,
          createdAt: new Date().toISOString(),
        }));

        toast({
          title: tModal('toasts.updated'),
          description: tModal('toasts.updatedDescription', { name: updated.data.name }),
        });
        onSaved({ ...updated.data, prices: finalPrices });
      }
      onOpenChange(false);
    } catch {
      toast({
        title: mode === 'create' ? tModal('toasts.createFailed') : tModal('toasts.updateFailed'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? tModal('createTitle') : tModal('editTitle')}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? tModal('createDescription') : tModal('editDescription')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{tFields('nameRequired')}</FormLabel>
                    <FormControl>
                      <Input placeholder={tFields('namePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nameAlias"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tFields('nameAlias')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tFields('nameAliasPlaceholder')}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tFields('barcode')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tFields('barcodePlaceholder')}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tracksExpiry"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{tFields('tracksExpiry')}</FormLabel>
                    <FormDescription>{tFields('tracksExpiryDescription')}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (!checked) {
                          form.setValue('expiryDate', null);
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch('tracksExpiry') && (
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tFields('expiryDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>{tModal('pricingTitle')}</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ priceTier: 'retail', price: 0, currency: 'USD' })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {tModal('addPriceButton')}
                </Button>
              </div>

              {fields.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg">
                  {tPricing('empty')}
                </div>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                      <FormField
                        control={form.control}
                        name={`prices.${index}.priceTier`}
                        render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {TIER_KEYS.map((key) => (
                                  <SelectItem key={key} value={key}>
                                    {tTiers(key)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`prices.${index}.price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="number" min="0" step="0.01" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`prices.${index}.currency`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <CurrencySelect value={field.value} onValueChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={tModal('removePriceAriaLabel')}
                        onClick={() => remove(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!online && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <WifiOff className="h-4 w-4 shrink-0" />
                {tModal('offlineNotice')}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tModal('cancel')}
              </Button>
              <Button type="submit" disabled={isSaving || !online}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tCommon('saving')}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {mode === 'create' ? tModal('create') : tModal('save')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default ItemQuickModal;
