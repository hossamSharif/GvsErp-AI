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
import { useTranslations } from 'next-intl';
import { useTenantSettings, useUpdateTenantSettings } from '@/hooks/use-settings';
import { useCurrencies } from '@/hooks/use-currencies';
import { Button } from '@/components/ui/button';
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
import type { TenantSettings, UpdateTenantSettingsInput } from '@erp-saas/shared';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import { LogoUpload } from '@/components/forms/logo-upload';

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
  logo_url: z.string().url().optional().or(z.literal('')).nullable(),
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
  const t = useTranslations('settings.general');
  const tc = useTranslations('common');

  // Fetch settings
  const { data: settingsData, isLoading } = useTenantSettings();

  // Fetch currencies for dropdown
  const { data: currenciesData } = useCurrencies({ limit: 100 });

  // Update mutation
  const updateMutation = useUpdateTenantSettings({
    onSuccess: () => {
      toast({
        title: tc('success'),
        description: t('messages.settingsUpdatedDescription'),
      });
    },
    onError: (error) => {
      toast({
        title: tc('error'),
        description: error.message || t('messages.updateError'),
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
      logo_url: settingsData?.data?.logo_url || '',
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
        logo_url: data.logo_url || undefined,
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
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('pageDescription')}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>{t('sections.preferences')}</CardTitle>
              <CardDescription>
                {t('sections.preferencesDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="default_language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.defaultLanguage')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="en">{t('languages.en')}</SelectItem>
                        <SelectItem value="ar">{t('languages.ar')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('fields.defaultLanguageDescription')}
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
                    <FormLabel>{t('fields.defaultTheme')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="light">{t('themes.light')}</SelectItem>
                        <SelectItem value="dark">{t('themes.dark')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>{t('fields.defaultThemeDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.defaultCurrency')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('fields.selectCurrency')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currenciesData?.data.map((currency) => (
                          <SelectItem key={currency.id} value={currency.code}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('fields.defaultCurrencyDescription')}
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
                    <FormLabel>{t('dateFormat')}</FormLabel>
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
                    <FormDescription>{t('fields.dateFormatDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('sections.companyInfo')}</CardTitle>
              <CardDescription>
                {t('sections.companyInfoDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Company Logo */}
              <FormField
                control={form.control}
                name="logo_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('companyLogo')}</FormLabel>
                    <FormDescription>
                      {t('companyLogoDescription')}
                    </FormDescription>
                    <FormControl>
                      <LogoUpload
                        value={field.value || null}
                        onChange={(url) => field.onChange(url || '')}
                        disabled={updateMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.companyName')}</FormLabel>
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
                    <FormLabel>{t('fields.companyEmail')}</FormLabel>
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
                    <FormLabel>{t('fields.companyPhone')}</FormLabel>
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
                    <FormLabel>{t('fields.companyAddress')}</FormLabel>
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
                    <FormLabel>{t('fields.taxNumber')}</FormLabel>
                    <FormControl>
                      <Input placeholder="Tax identification number" {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('fields.taxNumberDescription')}
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
              <CardTitle>{t('sections.businessPreferences')}</CardTitle>
              <CardDescription>{t('sections.businessPreferencesDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="fiscal_year_start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.fiscalYearStart')}</FormLabel>
                    <FormControl>
                      <Input placeholder="01-01 (MM-DD)" {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('fields.fiscalYearStartDescription')}
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
                    <FormLabel>{t('timeZone')}</FormLabel>
                    <FormControl>
                      <Input placeholder="America/New_York" {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('fields.timeZoneDescription')}
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
              <CardTitle>{t('sections.moduleActivation')}</CardTitle>
              <CardDescription>
                {t('sections.moduleActivationDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="accounting_module_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t('fields.accountingModule')}</FormLabel>
                      <FormDescription>
                        {t('fields.accountingModuleDescription')}
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
                      <FormLabel className="text-base">{t('fields.hrModule')}</FormLabel>
                      <FormDescription>
                        {t('fields.hrModuleDescription')}
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
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('actions.saving')}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {t('actions.saveSettings')}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
