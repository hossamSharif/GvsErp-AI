'use client';

/**
 * Bulk Price Update Dialog
 *
 * Dialog for updating prices on multiple items at once — either the selected
 * rows or every item in the tenant (optionally one category).
 * Supports percentage-based or fixed amount adjustments.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useBulkUpdatePrices, useBulkUpdateAllPrices, useItems } from '@/hooks/use-items';
import { useCategories } from '@/hooks/use-categories';
import { useToast } from '@/components/ui/use-toast';
import { CurrencySelect } from '@/components/forms/currency-select';
import type {
  ItemWithCategory,
  BulkPriceUpdateResult,
  BulkPriceUpdateAllResult,
} from '@erp/shared';
import { Loader2, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

// =============================================================================
// CONSTANTS
// =============================================================================

const TIER_KEYS = ['retail', 'wholesale', 'vip', 'cost'] as const;
const ALL_CATEGORIES = 'all';

// =============================================================================
// FORM SCHEMA
// =============================================================================

type BulkValidationMessages = {
  tierRequired: string;
  currencyRequired: string;
  percentageRange: string;
};

function createBulkPriceSchema(messages: BulkValidationMessages) {
  return z.object({
    adjustmentType: z.enum(['percentage', 'fixed']),
    adjustmentValue: z.coerce.number(),
    priceTier: z.string().min(1, messages.tierRequired),
    currency: z.string().min(1, messages.currencyRequired),
  }).refine(
    (data) => {
      if (data.adjustmentType === 'percentage') {
        return data.adjustmentValue >= -100 && data.adjustmentValue <= 1000;
      }
      return true;
    },
    {
      message: messages.percentageRange,
      path: ['adjustmentValue'],
    }
  );
}

type BulkPriceFormData = z.infer<ReturnType<typeof createBulkPriceSchema>>;

// =============================================================================
// PROPS
// =============================================================================

interface BulkPriceDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** 'selected' updates `items`; 'all' updates every item (optionally one category) */
  mode?: 'selected' | 'all';
  /** Selected items to update (mode 'selected') */
  items?: ItemWithCategory[];
  /** Callback when update is complete */
  onComplete?: (result: BulkPriceUpdateResult | BulkPriceUpdateAllResult) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BulkPriceDialog({
  open,
  onOpenChange,
  mode = 'selected',
  items = [],
  onComplete,
}: BulkPriceDialogProps) {
  const { toast } = useToast();
  const isAll = mode === 'all';
  const [result, setResult] = useState<BulkPriceUpdateResult | null>(null);
  const [allResult, setAllResult] = useState<BulkPriceUpdateAllResult | null>(null);
  const [categoryId, setCategoryId] = useState<string>(ALL_CATEGORIES);
  const [pendingData, setPendingData] = useState<BulkPriceFormData | null>(null);
  const t = useTranslations('items.bulkPrice');
  const tCommon = useTranslations('common');
  const tTiers = useTranslations('items.priceTiers');

  const scopeCategoryId = categoryId === ALL_CATEGORIES ? undefined : categoryId;
  const { data: categoriesData } = useCategories({ enabled: open && isAll });
  // limit=1: only meta.total is needed for the affected-items count
  const { data: scopeData, isLoading: isScopeLoading } = useItems(
    { categoryId: scopeCategoryId, page: 1, limit: 1 },
    { enabled: open && isAll }
  );
  const scopeCount = scopeData?.meta?.total ?? 0;

  const bulkPriceFormSchema = createBulkPriceSchema({
    tierRequired: t('validation.tierRequired'),
    currencyRequired: t('validation.currencyRequired'),
    percentageRange: t('validation.percentageRange'),
  });

  // Form
  const form = useForm<BulkPriceFormData>({
    resolver: zodResolver(bulkPriceFormSchema),
    defaultValues: {
      adjustmentType: 'percentage',
      adjustmentValue: 0,
      priceTier: 'retail',
      currency: 'USD',
    },
  });

  // Mutations
  const bulkUpdateMutation = useBulkUpdatePrices({
    onSuccess: (response) => {
      setResult(response.data);
      if (response.data.updatedCount > 0) {
        toast({
          title: t('toasts.pricesUpdated'),
          description: t('successDescription', { count: response.data.updatedCount }),
        });
      }
      if (onComplete) {
        onComplete(response.data);
      }
    },
    onError: (error) => {
      toast({
        title: tCommon('error'),
        description: error.message || t('toasts.updateFailed'),
        variant: 'destructive',
      });
    },
  });

  const bulkUpdateAllMutation = useBulkUpdateAllPrices({
    onSuccess: (response) => {
      setAllResult(response.data);
      setPendingData(null);
      if (response.data.updatedCount > 0) {
        toast({
          title: t('toasts.pricesUpdated'),
          description: t('successDescription', { count: response.data.updatedCount }),
        });
      }
      if (onComplete) {
        onComplete(response.data);
      }
    },
    onError: (error) => {
      setPendingData(null);
      toast({
        title: tCommon('error'),
        description: error.message || t('toasts.updateFailed'),
        variant: 'destructive',
      });
    },
  });

  const isPending = bulkUpdateMutation.isPending || bulkUpdateAllMutation.isPending;
  const hasResult = isAll ? allResult !== null : result !== null;

  // Handle form submission — 'all' mode asks for confirmation first
  const handleSubmit = useCallback(
    async (data: BulkPriceFormData) => {
      if (isAll) {
        setAllResult(null);
        setPendingData(data);
        return;
      }
      setResult(null);
      await bulkUpdateMutation.mutateAsync({
        itemIds: items.map((item) => item.id),
        adjustmentType: data.adjustmentType,
        adjustmentValue: data.adjustmentValue,
        priceTier: data.priceTier,
        currency: data.currency,
      });
    },
    [isAll, bulkUpdateMutation, items]
  );

  const handleConfirmAll = useCallback(() => {
    if (!pendingData) return;
    bulkUpdateAllMutation.mutate({
      categoryId: scopeCategoryId,
      adjustmentType: pendingData.adjustmentType,
      adjustmentValue: pendingData.adjustmentValue,
      priceTier: pendingData.priceTier,
      currency: pendingData.currency,
    });
  }, [pendingData, scopeCategoryId, bulkUpdateAllMutation]);

  // Handle dialog close
  const handleClose = useCallback(() => {
    if (!isPending) {
      setResult(null);
      setAllResult(null);
      setPendingData(null);
      setCategoryId(ALL_CATEGORIES);
      form.reset();
      onOpenChange(false);
    }
  }, [isPending, form, onOpenChange]);

  // Watch adjustment type for label changes
  const adjustmentType = form.watch('adjustmentType');
  // Lock the inputs while confirming or once the update has run
  const isLocked = pendingData !== null || hasResult;

  // The confirmation/result alerts grow the dialog — keep the action buttons in view
  const footerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pendingData || hasResult) {
      footerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [pendingData, hasResult]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isAll ? t('allTitle') : t('title')}</DialogTitle>
          <DialogDescription>
            {isAll ? t('allDescription') : t('description', { count: items.length })}
          </DialogDescription>
        </DialogHeader>

        {isAll ? (
          /* Scope: all items, optionally one category */
          <div className="space-y-2">
            <Label>{t('categoryScope')}</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={isLocked}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>{t('allCategories')}</SelectItem>
                {(categoriesData?.data ?? []).map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {isScopeLoading ? (
                <Loader2 className="inline h-3 w-3 animate-spin" />
              ) : (
                t('affectedCount', { count: scopeCount })
              )}
            </p>
          </div>
        ) : (
          /* Selected Items Summary */
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-2 bg-muted rounded-md">
            {items.slice(0, 10).map((item) => (
              <Badge key={item.id} variant="secondary" className="text-xs">
                {item.name}
              </Badge>
            ))}
            {items.length > 10 && (
              <Badge variant="outline" className="text-xs">
                {t('moreItems', { count: items.length - 10 })}
              </Badge>
            )}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <fieldset disabled={isLocked} className="space-y-4">
              {/* Adjustment Type */}
              <FormField
                control={form.control}
                name="adjustmentType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>{t('adjustmentType')}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="percentage" id="percentage" />
                          <Label htmlFor="percentage">{t('percentage')}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="fixed" id="fixed" />
                          <Label htmlFor="fixed">{t('fixed')}</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Adjustment Value */}
              <FormField
                control={form.control}
                name="adjustmentValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {adjustmentType === 'percentage'
                        ? t('percentageLabel')
                        : t('fixedLabel')}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step={adjustmentType === 'percentage' ? '0.1' : '0.01'}
                          placeholder={adjustmentType === 'percentage' ? '10' : '5.00'}
                          {...field}
                        />
                        {adjustmentType === 'percentage' && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            %
                          </span>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      {adjustmentType === 'percentage'
                        ? t('percentageDescription')
                        : t('fixedDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                {/* Price Tier */}
                <FormField
                  control={form.control}
                  name="priceTier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('priceTier')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('priceTierPlaceholder')} />
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

                {/* Currency */}
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('currency')}</FormLabel>
                      <FormControl>
                        <CurrencySelect
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder={t('currencyPlaceholder')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </fieldset>

            {/* Confirmation (all mode) */}
            {pendingData && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('confirmTitle')}</AlertTitle>
                <AlertDescription>
                  {t('confirmDescription', {
                    count: scopeCount,
                    tier: tTiers(pendingData.priceTier as (typeof TIER_KEYS)[number]),
                    value:
                      pendingData.adjustmentType === 'percentage'
                        ? `${pendingData.adjustmentValue}%`
                        : `${pendingData.adjustmentValue} ${pendingData.currency}`,
                  })}
                </AlertDescription>
              </Alert>
            )}

            {/* Results (all mode) */}
            {allResult && (
              <div className="space-y-2">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>{t('successTitle')}</AlertTitle>
                  <AlertDescription>
                    {t('successDescription', { count: allResult.updatedCount })}
                  </AlertDescription>
                </Alert>
                {allResult.skippedCount > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {t('skippedDescription', { count: allResult.skippedCount })}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Results (selected mode) */}
            {result && (
              <div className="space-y-2">
                {result.updatedCount > 0 && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>{t('successTitle')}</AlertTitle>
                    <AlertDescription>
                      {t('successDescription', { count: result.updatedCount })}
                    </AlertDescription>
                  </Alert>
                )}
                {result.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t('failedTitle')}</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside text-sm mt-1">
                        {result.errors.slice(0, 5).map((err, idx) => (
                          <li key={idx}>{err.error}</li>
                        ))}
                        {result.errors.length > 5 && (
                          <li>{t('moreErrors', { count: result.errors.length - 5 })}</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div ref={footerRef}>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={pendingData ? () => setPendingData(null) : handleClose}
                disabled={isPending}
              >
                {hasResult ? t('close') : t('cancel')}
              </Button>
              {pendingData && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleConfirmAll}
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('updating')}
                    </>
                  ) : (
                    t('confirm')
                  )}
                </Button>
              )}
              {!hasResult && !pendingData && (
                <Button
                  type="submit"
                  disabled={isPending || (isAll && (isScopeLoading || scopeCount === 0))}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('updating')}
                    </>
                  ) : (
                    t('submit')
                  )}
                </Button>
              )}
            </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
