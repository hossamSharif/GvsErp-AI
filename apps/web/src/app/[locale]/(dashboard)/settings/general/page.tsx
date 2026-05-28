'use client';

/**
 * General Settings Page
 *
 * Manage general tenant settings:
 * - Language and theme preferences
 * - Company information
 * - Business preferences
 * - Module activation
 */

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTenantSettings, useUpdateTenantSettings } from '@/hooks/use-settings';
import { Button } from '@/components/ui/button';
import { CurrencySelect } from '@/components/forms/currency-select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { TenantSettings, UpdateTenantSettingsInput } from '@erp/shared';
import { Save, Loader2, ArrowLeft } from 'lucide-react';

// Form schema
const settingsFormSchema = z.object({
  default_language: z.enum(['en', 'ar']).optional(),
  default_theme: z.enum(['light', 'dark']).optional(),
  default_currency: z.string().optional(),
  company_name: z.string().max(255).optional(),
  company_email: z.string().email('Invalid email format').max(255).optional().or(z.literal('')),
  company_phone: z.string().max(50).optional().or(z.literal('')),
  company_address: z.string().max(500).optional().or(z.literal('')),
  tax_number: z.string().max(50).optional().or(z.literal('')),
  accounting_module_enabled: z.boolean().optional(),
  hr_module_enabled: z.boolean().optional(),
  fiscal_year_start: z.string().optional().or(z.literal('')),
  time_zone: z.string().optional().or(z.literal('')),
  date_format: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;

export default function GeneralSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();

  // Fetch settings
  const { data: settingsData, isLoading } = useTenantSettings();

  // Update mutation
  const updateMutation = useUpdateTenantSettings({
    onSuccess: () => {
      toast({
        title: 'Settings updated',
        description: 'Your settings have been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update settings',
        variant: 'destructive',
      });
    },
  });

  // Form
  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    values: {
      default_language: settingsData?.data?.default_language || 'en',
      default_theme: settingsData?.data?.default_theme || 'light',
      default_currency: settingsData?.data?.default_currency || '',
      company_name: settingsData?.data?.company_name || '',
      company_email: settingsData?.data?.company_email || '',
      company_phone: settingsData?.data?.company_phone || '',
      company_address: settingsData?.data?.company_address || '',
      tax_number: settingsData?.data?.tax_number || '',
      accounting_module_enabled: settingsData?.data?.accounting_module_enabled || false,
      hr_module_enabled: settingsData?.data?.hr_module_enabled || false,
      fiscal_year_start: settingsData?.data?.fiscal_year_start || '',
      time_zone: settingsData?.data?.time_zone || '',
      date_format: settingsData?.data?.date_format || 'DD/MM/YYYY',
    },
  });

  const onSubmit = useCallback(
    (data: SettingsFormData) => {
      const updateData: UpdateTenantSettingsInput = {
        default_language: data.default_language,
        default_theme: data.default_theme,
        default_currency: data.default_currency || undefined,
        company_name: data.company_name || undefined,
        company_email: data.company_email || undefined,
        company_phone: data.company_phone || undefined,
        company_address: data.company_address || undefined,
        tax_number: data.tax_number || undefined,
        accounting_module_enabled: data.accounting_module_enabled,
        hr_module_enabled: data.hr_module_enabled,
        fiscal_year_start: data.fiscal_year_start || undefined,
        time_zone: data.time_zone || undefined,
        date_format: data.date_format,
      };
      updateMutation.mutate(updateData);
    },
    [updateMutation]
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/settings`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">General Settings</h1>
          <p className="text-muted-foreground">
            Configure language, theme, and company information
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>
                Default language and theme settings for your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="default_language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Language</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="ar">Arabic</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Default language for new users and system messages
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_theme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Theme</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Default theme for new users</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Currency</FormLabel>
                    <FormControl>
                      <CurrencySelect
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      Default currency for transactions and reports
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date_format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Format</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>How dates are displayed</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Your company details for invoices and reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Inc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="contact@company.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Phone</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="123 Business St, City, Country"
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tax_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Number / VAT ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Tax identification number" {...field} />
                    </FormControl>
                    <FormDescription>
                      Your company's tax registration number
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Business Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Business Preferences</CardTitle>
              <CardDescription>Configure fiscal year and timezone</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="fiscal_year_start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fiscal Year Start</FormLabel>
                    <FormControl>
                      <Input placeholder="01-01 (MM-DD)" {...field} />
                    </FormControl>
                    <FormDescription>
                      Month and day when your fiscal year starts (e.g., 01-01 for January 1st)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time_zone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Zone</FormLabel>
                    <FormControl>
                      <Input placeholder="America/New_York" {...field} />
                    </FormControl>
                    <FormDescription>
                      IANA timezone identifier (e.g., America/New_York, Europe/London)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Module Activation */}
          <Card>
            <CardHeader>
              <CardTitle>Module Activation</CardTitle>
              <CardDescription>
                Enable or disable optional modules for your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="accounting_module_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Accounting Module</FormLabel>
                      <FormDescription>
                        Enable advanced accounting features and chart of accounts
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hr_module_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">HR Module</FormLabel>
                      <FormDescription>
                        Enable human resources management and payroll features
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/${locale}/settings`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
