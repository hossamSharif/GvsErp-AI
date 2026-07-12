'use client';

/**
 * Item Form Component
 *
 * Comprehensive form for creating and editing items with:
 * - Basic info (name, SKU, barcode, brand)
 * - Category selection
 * - Pricing tiers
 * - Packaging options
 * - Image upload
 */

import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations, useLocale } from 'next-intl';
import { z } from 'zod';
import Link from 'next/link';
import { useDirection } from '@/hooks/use-direction';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CurrencySelect } from '@/components/forms/currency-select';
import { useCurrencies } from '@/hooks/use-currencies';
import { cn } from '@/lib/utils';
import type {
  ItemWithRelations,
  CreateItemInput,
  UpdateItemInput,
  Category,
} from '@erp/shared';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';

// =============================================================================
// CONSTANTS
// =============================================================================

const UNIT_KEYS = [
  'piece',
  'kg',
  'gram',
  'liter',
  'ml',
  'meter',
  'cm',
  'box',
  'carton',
  'pack',
  'dozen',
] as const;

const TIER_KEYS = ['retail', 'wholesale', 'vip', 'cost'] as const;

// =============================================================================
// FORM SCHEMA
// =============================================================================

type ValidationMessages = {
  nameRequired: string;
  unitRequired: string;
  priceTierRequired: string;
  pricePositive: string;
  packagingNameRequired: string;
  packagingQuantityMin: string;
  taxRateRange: string;
  nameMaxLength: string;
  skuMaxLength: string;
  barcodeMaxLength: string;
  expiryDateRequired: string;
};

function createItemFormSchema(messages: ValidationMessages) {
  const priceSchema = z.object({
    priceTier: z.string().min(1, messages.priceTierRequired),
    price: z.coerce.number().min(0, messages.pricePositive),
    currency: z.string().default('USD'),
    effectiveFrom: z.string().nullable().optional(),
    effectiveTo: z.string().nullable().optional(),
  });

  const packagingSchema = z.object({
    name: z.string().min(1, messages.packagingNameRequired),
    quantity: z.coerce.number().int().min(1, messages.packagingQuantityMin),
    barcode: z.string().nullable().optional(),
  });

  return z.object({
    name: z.string().min(1, messages.nameRequired).max(255, messages.nameMaxLength),
    nameAlias: z.string().max(255, messages.nameMaxLength).nullable().optional(),
    sku: z.string().max(100, messages.skuMaxLength).nullable().optional(),
    barcode: z.string().max(100, messages.barcodeMaxLength).nullable().optional(),
    brand: z.string().max(255, messages.nameMaxLength).nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    unitOfMeasure: z.string().min(1, messages.unitRequired).default('piece'),
    taxRate: z.coerce
      .number()
      .min(0, messages.taxRateRange)
      .max(100, messages.taxRateRange)
      .default(0),
    isActive: z.boolean().default(true),
    images: z.array(z.string()).default([]),
    tracksExpiry: z.boolean().default(false),
    expiryDate: z.string().nullable().optional(),
    prices: z.array(priceSchema).optional(),
    packagings: z.array(packagingSchema).optional(),
  }).refine(
    (data) => !data.tracksExpiry || !!data.expiryDate,
    { message: messages.expiryDateRequired, path: ['expiryDate'] }
  );
}

type ItemFormData = z.infer<ReturnType<typeof createItemFormSchema>>;

// =============================================================================
// PROPS
// =============================================================================

interface ItemFormProps {
  /** Existing item data for editing */
  item?: ItemWithRelations;
  /** Available categories */
  categories?: Category[];
  /** Submit handler */
  onSubmit: (data: CreateItemInput | UpdateItemInput) => Promise<void>;
  /** Cancel handler */
  onCancel?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Mode: create or edit */
  mode?: 'create' | 'edit';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ItemForm({
  item,
  categories = [],
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
}: ItemFormProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const t = useTranslations('items.form');
  const tFields = useTranslations('items.form.fields');
  const tTabs = useTranslations('items.form.tabs');
  const tBasic = useTranslations('items.form.basicInfo');
  const tPricing = useTranslations('items.form.pricing');
  const tPackaging = useTranslations('items.form.packaging');
  const tImages = useTranslations('items.form.images');
  const tActions = useTranslations('items.form.actions');
  const tCommon = useTranslations('common');
  const tUnits = useTranslations('items.units');
  const tTiers = useTranslations('items.priceTiers');
  const locale = useLocale();
  const { direction } = useDirection();

  const itemFormSchema = createItemFormSchema({
    nameRequired: t('validation.nameRequired'),
    unitRequired: t('validation.unitRequired'),
    priceTierRequired: t('validation.priceTierRequired'),
    pricePositive: t('validation.pricePositive'),
    packagingNameRequired: t('validation.packagingNameRequired'),
    packagingQuantityMin: t('validation.packagingQuantityMin'),
    taxRateRange: t('validation.taxRateRange'),
    nameMaxLength: t('validation.nameMaxLength'),
    skuMaxLength: t('validation.skuMaxLength'),
    barcodeMaxLength: t('validation.barcodeMaxLength'),
    expiryDateRequired: t('validation.expiryDateRequired'),
  });

  // Initialize form with default values or existing item data
  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      name: item?.name || '',
      nameAlias: item?.nameAlias || '',
      sku: item?.sku || '',
      barcode: item?.barcode || '',
      brand: item?.brand || '',
      categoryId: item?.categoryId || undefined,
      unitOfMeasure: item?.unitOfMeasure || 'piece',
      taxRate: item?.taxRate || 0,
      isActive: item?.isActive ?? true,
      images: item?.images || [],
      tracksExpiry: item?.tracksExpiry ?? false,
      expiryDate: item?.expiryDate || null,
      prices: item?.prices?.map((p) => ({
        priceTier: p.priceTier,
        price: p.price,
        currency: p.currency,
        effectiveFrom: p.effectiveFrom,
        effectiveTo: p.effectiveTo,
      })) || [],
      packagings: item?.packagings?.map((p) => ({
        name: p.name,
        quantity: p.quantity,
        barcode: p.barcode,
      })) || [],
    },
  });

  // Prices field array
  const {
    fields: priceFields,
    append: appendPrice,
    remove: removePrice,
  } = useFieldArray({
    control: form.control,
    name: 'prices',
  });
  const priceInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Tenant's configured default currency, used to pre-select new price rows.
  const { data: currenciesData } = useCurrencies({ limit: 100 });
  const defaultCurrencyCode =
    currenciesData?.data.find((c) => c.is_default)?.code ?? 'USD';

  // Packagings field array
  const {
    fields: packagingFields,
    append: appendPackaging,
    remove: removePackaging,
  } = useFieldArray({
    control: form.control,
    name: 'packagings',
  });

  // Handle form submission
  const handleSubmit = async (data: ItemFormData) => {
    const submitData = {
      ...data,
      nameAlias: data.nameAlias || null,
      sku: data.sku || null,
      barcode: data.barcode || null,
      brand: data.brand || null,
      categoryId: data.categoryId || null,
      expiryDate: data.tracksExpiry ? data.expiryDate || null : null,
    };

    await onSubmit(submitData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} dir={direction}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">{tTabs('basic')}</TabsTrigger>
            <TabsTrigger value="pricing">{tTabs('pricing')}</TabsTrigger>
            <TabsTrigger value="packaging">{tTabs('packaging')}</TabsTrigger>
            <TabsTrigger value="images">{tTabs('images')}</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{tBasic('title')}</CardTitle>
                <CardDescription>{tBasic('description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tFields('nameRequired')}</FormLabel>
                      <FormControl>
                        <Input placeholder={tFields('namePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Name Alias */}
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
                      <FormDescription>
                        {tFields('nameAliasDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* SKU */}
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tFields('sku')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={tFields('skuPlaceholder')}
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Barcode */}
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
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Brand */}
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tFields('brand')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={tFields('brandPlaceholder')}
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Category */}
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>{tFields('category')}</FormLabel>
                          <Link
                            href={`/${locale}/items/categories`}
                            onClick={(e) => {
                              if (
                                form.formState.isDirty &&
                                !window.confirm(tFields('leaveConfirm'))
                              ) {
                                e.preventDefault();
                              }
                            }}
                            className="text-xs text-primary hover:underline"
                          >
                            {tFields('manageCategories')}
                          </Link>
                        </div>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === '__none__' ? null : value)
                          }
                          value={field.value || '__none__'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={tFields('categoryPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">{tFields('categoryNone')}</SelectItem>
                            {categories.length === 0 ? (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                {tFields('categoryEmpty')}
                              </div>
                            ) : (
                              categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Unit of Measure */}
                  <FormField
                    control={form.control}
                    name="unitOfMeasure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tFields('unit')}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={tFields('unitPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {UNIT_KEYS.map((key) => (
                              <SelectItem key={key} value={key}>
                                {tUnits(key)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Tax Rate */}
                  <FormField
                    control={form.control}
                    name="taxRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tFields('taxRate')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder={tFields('taxRatePlaceholder')}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>{tFields('taxRateDescription')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Active Status */}
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">{tFields('active')}</FormLabel>
                        <FormDescription>
                          {tFields('activeDescription')}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Tracks Expiry */}
                <FormField
                  control={form.control}
                  name="tracksExpiry"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">{tFields('tracksExpiry')}</FormLabel>
                        <FormDescription>
                          {tFields('tracksExpiryDescription')}
                        </FormDescription>
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

                {/* Expiry Date */}
                {form.watch('tracksExpiry') && (
                  <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tFields('expiryDate')}</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{tPricing('title')}</CardTitle>
                  <CardDescription>{tPricing('description')}</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newIndex = priceFields.length;
                    appendPrice({
                      priceTier: 'retail',
                      price: 0,
                      currency: defaultCurrencyCode,
                      effectiveFrom: null,
                      effectiveTo: null,
                    });
                    requestAnimationFrame(() => {
                      priceInputRefs.current[newIndex]?.focus();
                      priceInputRefs.current[newIndex]?.select();
                    });
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {tPricing('addButton')}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {priceFields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {tPricing('empty')}
                  </div>
                ) : (
                  priceFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end p-4 border rounded-lg"
                    >
                      {/* Price Tier */}
                      <FormField
                        control={form.control}
                        name={`prices.${index}.priceTier`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{tPricing('tier')}</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Price */}
                      <FormField
                        control={form.control}
                        name={`prices.${index}.price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{tPricing('price')}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                {...field}
                                ref={(el) => {
                                  field.ref(el);
                                  priceInputRefs.current[index] = el;
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Currency */}
                      <FormField
                        control={form.control}
                        name={`prices.${index}.currency`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{tPricing('currency')}</FormLabel>
                            <FormControl>
                              <CurrencySelect
                                value={field.value}
                                onValueChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Effective From */}
                      <FormField
                        control={form.control}
                        name={`prices.${index}.effectiveFrom`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{tPricing('effectiveFrom')} <span className="text-muted-foreground font-normal">({tCommon('optional')})</span></FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormDescription>{tPricing('effectiveFromDescription')}</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Delete Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={tPricing('removeAriaLabel')}
                        onClick={() => removePrice(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Packaging Tab */}
          <TabsContent value="packaging" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{tPackaging('title')}</CardTitle>
                  <CardDescription>{tPackaging('description')}</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    appendPackaging({
                      name: '',
                      quantity: 1,
                      barcode: null,
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {tPackaging('addButton')}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {packagingFields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {tPackaging('empty')}
                  </div>
                ) : (
                  packagingFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 border rounded-lg"
                    >
                      {/* Name */}
                      <FormField
                        control={form.control}
                        name={`packagings.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{tPackaging('name')}</FormLabel>
                            <FormControl>
                              <Input placeholder={tPackaging('namePlaceholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Quantity */}
                      <FormField
                        control={form.control}
                        name={`packagings.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{tPackaging('quantity')}</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Barcode */}
                      <FormField
                        control={form.control}
                        name={`packagings.${index}.barcode`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{tPackaging('barcode')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={tPackaging('barcodeOptional')}
                                {...field}
                                value={field.value || ''}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Delete Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={tPackaging('removeAriaLabel')}
                        onClick={() => removePackaging(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Images Tab */}
          <TabsContent value="images" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{tImages('title')}</CardTitle>
                <CardDescription>{tImages('description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                  <p>{tImages('placeholder')}</p>
                  <p className="text-sm mt-2">{tImages('hint')}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              {tActions('cancel')}
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tCommon('saving')}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {mode === 'create' ? tActions('create') : tActions('save')}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
