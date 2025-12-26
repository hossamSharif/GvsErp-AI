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

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
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
import { cn } from '@/lib/utils';
import type {
  ItemWithRelations,
  CreateItemInput,
  UpdateItemInput,
  Category,
} from '@erp-saas/shared';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';

// =============================================================================
// FORM SCHEMA
// =============================================================================

const priceSchema = z.object({
  priceTier: z.string().min(1, 'Price tier is required'),
  price: z.coerce.number().min(0, 'Price must be positive'),
  currency: z.string().default('USD'),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
});

const packagingSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  barcode: z.string().nullable().optional(),
});

const itemFormSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(255),
  nameAlias: z.string().max(255).nullable().optional(),
  sku: z.string().max(100).nullable().optional(),
  barcode: z.string().max(100).nullable().optional(),
  brand: z.string().max(255).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  unitOfMeasure: z.string().min(1, 'Unit is required').default('piece'),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
  images: z.array(z.string()).default([]),
  prices: z.array(priceSchema).optional(),
  packagings: z.array(packagingSchema).optional(),
});

type ItemFormData = z.infer<typeof itemFormSchema>;

// =============================================================================
// CONSTANTS
// =============================================================================

const UNITS_OF_MEASURE = [
  { value: 'piece', label: 'Piece' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'gram', label: 'Gram (g)' },
  { value: 'liter', label: 'Liter (L)' },
  { value: 'ml', label: 'Milliliter (mL)' },
  { value: 'meter', label: 'Meter (m)' },
  { value: 'cm', label: 'Centimeter (cm)' },
  { value: 'box', label: 'Box' },
  { value: 'carton', label: 'Carton' },
  { value: 'pack', label: 'Pack' },
  { value: 'dozen', label: 'Dozen' },
];

const PRICE_TIERS = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'vip', label: 'VIP' },
  { value: 'cost', label: 'Cost' },
];

const CURRENCIES = [
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'GBP', label: 'British Pound (£)' },
  { value: 'EGP', label: 'Egyptian Pound (E£)' },
  { value: 'SAR', label: 'Saudi Riyal (﷼)' },
  { value: 'AED', label: 'UAE Dirham (د.إ)' },
];

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
  const t = useTranslations('items');

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
    };

    await onSubmit(submitData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">{t('tabs.basic')}</TabsTrigger>
            <TabsTrigger value="pricing">{t('tabs.pricing')}</TabsTrigger>
            <TabsTrigger value="packaging">{t('tabs.packaging')}</TabsTrigger>
            <TabsTrigger value="images">{t('tabs.images')}</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('form.basicInfo')}</CardTitle>
                <CardDescription>
                  {t('form.basicInfoDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('fields.name')} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t('placeholders.enterItemName')} {...field} />
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
                      <FormLabel>{t('fields.nameAlias')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('placeholders.enterAlternativeName')}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('form.alternativeNameHint')}
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
                        <FormLabel>{t('fields.sku')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('placeholders.enterSku')}
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
                        <FormLabel>{t('fields.barcode')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('placeholders.enterBarcode')}
                            {...field}
                            value={field.value || ''}
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
                        <FormLabel>{t('fields.brand')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('placeholders.enterBrand')}
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
                        <FormLabel>{t('fields.category')}</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                          value={field.value || '__none__'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('placeholders.selectCategory')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">{t('form.noCategory')}</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
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
                        <FormLabel>{t('fields.unitOfMeasure')} *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('placeholders.selectUnit')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {UNITS_OF_MEASURE.map((unit) => (
                              <SelectItem key={unit.value} value={unit.value}>
                                {t(`units.${unit.value}`)}
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
                        <FormLabel>{t('fields.taxRate')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            {...field}
                          />
                        </FormControl>
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
                        <FormLabel className="text-base">{t('fields.isActive')}</FormLabel>
                        <FormDescription>
                          {t('form.activeStatusHint')}
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{t('form.pricingTiers')}</CardTitle>
                  <CardDescription>
                    {t('form.pricingDescription')}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    appendPrice({
                      priceTier: 'retail',
                      price: 0,
                      currency: 'USD',
                      effectiveFrom: null,
                      effectiveTo: null,
                    })
                  }
                >
                  <Plus className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                  {t('buttons.addPrice')}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {priceFields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('form.noPricesYet')}
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
                            <FormLabel>{t('fields.priceTier')}</FormLabel>
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
                                {PRICE_TIERS.map((tier) => (
                                  <SelectItem key={tier.value} value={tier.value}>
                                    {t(`priceTiers.${tier.value}`)}
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
                            <FormLabel>{t('fields.price')}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
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
                        name={`prices.${index}.currency`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('fields.currency')}</FormLabel>
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
                                {CURRENCIES.map((curr) => (
                                  <SelectItem key={curr.value} value={curr.value}>
                                    {t(`currencies.${curr.value}`)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                            <FormLabel>{t('fields.fromDate')}</FormLabel>
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

                      {/* Delete Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
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
                  <CardTitle>{t('form.packagingOptions')}</CardTitle>
                  <CardDescription>
                    {t('form.packagingDescription')}
                  </CardDescription>
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
                  <Plus className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                  {t('buttons.addPackaging')}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {packagingFields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('form.noPackagingYet')}
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
                            <FormLabel>{t('fields.name')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('placeholders.packagingName')} {...field} />
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
                            <FormLabel>{t('fields.unitsPerPackage')}</FormLabel>
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
                            <FormLabel>{t('fields.packageBarcode')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t('placeholders.optional')}
                                {...field}
                                value={field.value || ''}
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
                <CardTitle>{t('form.productImages')}</CardTitle>
                <CardDescription>
                  {t('form.imagesDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                  <p>{t('form.imageUploadPlaceholder')}</p>
                  <p className="text-sm mt-2">
                    {t('form.imageUploadHint')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('buttons.cancel')}
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />
                {t('buttons.saving')}
              </>
            ) : (
              <>
                <Save className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                {mode === 'create' ? t('buttons.createItem') : t('buttons.saveChanges')}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
