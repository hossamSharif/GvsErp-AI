/**
 * Loyalty Program Configuration Component
 * Phase 7: User Story 5 - Manage Point of Sale Locations
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Gift, Award } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { POSLoyaltySettings } from '@repo/shared';

const loyaltyConfigSchema = z.object({
  enabled: z.boolean(),
  points_per_currency: z.number().min(0).max(1000),
  redemption_rate: z.number().min(0).max(1),
});

type LoyaltyConfigFormValues = z.infer<typeof loyaltyConfigSchema>;

interface LoyaltyConfigProps {
  initialSettings?: POSLoyaltySettings;
  onSave: (settings: POSLoyaltySettings) => Promise<void>;
  isLoading?: boolean;
}

export function LoyaltyConfig({ initialSettings, onSave, isLoading }: LoyaltyConfigProps) {
  const [saving, setSaving] = useState(false);

  const form = useForm<LoyaltyConfigFormValues>({
    resolver: zodResolver(loyaltyConfigSchema),
    defaultValues: {
      enabled: initialSettings?.enabled || false,
      points_per_currency: initialSettings?.points_per_currency || 1,
      redemption_rate: initialSettings?.redemption_rate || 0.01,
    },
  });

  // Update form when initial settings change
  useEffect(() => {
    if (initialSettings) {
      form.reset({
        enabled: initialSettings.enabled || false,
        points_per_currency: initialSettings.points_per_currency || 1,
        redemption_rate: initialSettings.redemption_rate || 0.01,
      });
    }
  }, [initialSettings, form]);

  const handleSubmit = async (values: LoyaltyConfigFormValues) => {
    setSaving(true);
    try {
      await onSave(values);
    } finally {
      setSaving(false);
    }
  };

  const enabled = form.watch('enabled');
  const pointsPerCurrency = form.watch('points_per_currency');
  const redemptionRate = form.watch('redemption_rate');

  // Calculate example values
  const exampleSpend = 100;
  const examplePoints = exampleSpend * pointsPerCurrency;
  const exampleValue = examplePoints * redemptionRate;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Loyalty Program Configuration
        </CardTitle>
        <CardDescription>
          Configure customer loyalty points and rewards for this POS location
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Enable/Disable Toggle */}
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Enable Loyalty Program</FormLabel>
                    <FormDescription>
                      Allow customers to earn and redeem loyalty points
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Points Configuration */}
            {enabled && (
              <>
                <FormField
                  control={form.control}
                  name="points_per_currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Points Per Currency Unit</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1000"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        How many points customers earn per $1 spent. For example, 1 point per $1, or
                        10 points per $1.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="redemption_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Redemption Rate (Points to Currency)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          max="1"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Value of each point when redeemed. For example, 0.01 means 100 points = $1.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Example Calculation */}
                <Card className="bg-muted">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Example Calculation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span>Customer spends:</span>
                      <span className="font-medium">${exampleSpend.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Points earned:</span>
                      <span className="font-medium">{examplePoints.toFixed(0)} points</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span>Points value:</span>
                      <span className="font-medium">${exampleValue.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      At this rate, customers get {((exampleValue / exampleSpend) * 100).toFixed(1)}
                      % back in loyalty rewards.
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || isLoading}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
