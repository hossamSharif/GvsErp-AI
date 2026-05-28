'use client';

/**
 * Bulk Price Update Dialog
 *
 * Dialog for updating prices on multiple items at once.
 * Supports percentage-based or fixed amount adjustments.
 */

import { useState, useCallback } from 'react';
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
import { useBulkUpdatePrices } from '@/hooks/use-items';
import { useToast } from '@/components/ui/use-toast';
import { CurrencySelect } from '@/components/forms/currency-select';
import type { ItemWithCategory, BulkPriceUpdateResult } from '@erp/shared';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

// =============================================================================
// CONSTANTS
// =============================================================================

const TIER_KEYS = ['retail', 'wholesale', 'vip', 'cost'] as const;

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
  /** Selected items to update */
  items: ItemWithCategory[];
  /** Callback when update is complete */
  onComplete?: (result: BulkPriceUpdateResult) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BulkPriceDialog({
  open,
  onOpenChange,
  items,
  onComplete,
}: BulkPriceDialogProps) {
  const { toast } = useToast();
  const [result, setResult] = useState<BulkPriceUpdateResult | null>(null);
  const t = useTranslations('items.bulkPrice');
  const tCommon = useTranslations('common');
  const tTiers = useTranslations('items.priceTiers');

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

  // Mutation
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

  // Handle form submission
  const handleSubmit = useCallback(
    async (data: BulkPriceFormData) => {
      setResult(null);
      await bulkUpdateMutation.mutateAsync({
        itemIds: items.map((item) => item.id),
        adjustmentType: data.adjustmentType,
        adjustmentValue: data.adjustmentValue,
        priceTier: data.priceTier,
        currency: data.currency,
      });
    },
    [bulkUpdateMutation, items]
  );

  // Handle dialog close
  const handleClose = useCallback(() => {
    if (!bulkUpdateMutation.isPending) {
      setResult(null);
      form.reset();
      onOpenChange(false);
    }
  }, [bulkUpdateMutation.isPending, form, onOpenChange]);

  // Watch adjustment type for label changes
  const adjustmentType = form.watch('adjustmentType');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description', { count: items.length })}
          </DialogDescription>
        </DialogHeader>

        {/* Selected Items Summary */}
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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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

            {/* Results */}
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={bulkUpdateMutation.isPending}
              >
                {result ? t('close') : t('cancel')}
              </Button>
              {!result && (
                <Button type="submit" disabled={bulkUpdateMutation.isPending}>
                  {bulkUpdateMutation.isPending ? (
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
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
