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

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
} from '@erp/shared';
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
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="packaging">Packaging</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Enter the basic details of the item.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter item name" {...field} />
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
                      <FormLabel>Alternative Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter alternative name"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        An alternative name for searching
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
                        <FormLabel>SKU</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter SKU"
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
                        <FormLabel>Barcode</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter barcode"
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
                        <FormLabel>Brand</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter brand"
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
                        <FormLabel>Category</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">No category</SelectItem>
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
                        <FormLabel>Unit of Measure *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {UNITS_OF_MEASURE.map((unit) => (
                              <SelectItem key={unit.value} value={unit.value}>
                                {unit.label}
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
                        <FormLabel>Tax Rate (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="e.g. 15 for 15%"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Enter the tax percentage (0-100)</FormDescription>
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
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>
                          Inactive items won&apos;t appear in search results
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
                  <CardTitle>Pricing Tiers</CardTitle>
                  <CardDescription>
                    Set different prices for different customer types.
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
                  <Plus className="mr-2 h-4 w-4" />
                  Add Price
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {priceFields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No prices added yet. Click &quot;Add Price&quot; to create a
                    pricing tier.
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
                            <FormLabel>Tier</FormLabel>
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
                                    {tier.label}
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
                            <FormLabel>Price</FormLabel>
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
                            <FormLabel>Currency</FormLabel>
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
                                    {curr.label}
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
                            <FormLabel>From Date</FormLabel>
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
                        aria-label="Remove price tier"
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
                  <CardTitle>Packaging Options</CardTitle>
                  <CardDescription>
                    Define different packaging units (e.g., box of 12, carton of
                    24).
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
                  <Plus className="mr-2 h-4 w-4" />
                  Add Packaging
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {packagingFields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No packaging options added yet. Click &quot;Add
                    Packaging&quot; to create one.
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
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Box" {...field} />
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
                            <FormLabel>Units per Package</FormLabel>
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
                            <FormLabel>Package Barcode</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Optional"
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
                        aria-label="Remove packaging option"
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
                <CardTitle>Product Images</CardTitle>
                <CardDescription>
                  Upload images of your product. The first image will be the
                  primary image.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                  <p>Image upload component will be added here.</p>
                  <p className="text-sm mt-2">
                    Drag and drop or click to upload images.
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
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {mode === 'create' ? 'Create Item' : 'Save Changes'}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
