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
import { useDirection } from '@/hooks/use-direction';
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
import { useTranslations } from 'next-intl';
import type { TenantSettings, UpdateTenantSettingsInput } from '@erp/shared';
import { Save, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { PRINT_TEMPLATES, printTemplateFromSettings } from '@/lib/print-template';
import { DEFAULT_DIAL_CODE } from '@/lib/whatsapp';
import { TenantLogoField } from '@/components/settings/tenant-logo-field';

// Form schema (built per render so validation messages follow the active locale)
function createSettingsSchema(messages: { invalidEmail: string; invalidDialCode: string }) {
  return z.object({
    default_language: z.enum(['en', 'ar']).optional(),
    default_theme: z.enum(['light', 'dark']).optional(),
    default_currency: z.string().optional(),
    company_name: z.string().max(255).optional(),
    company_email: z.string().email(messages.invalidEmail).max(255).optional().or(z.literal('')),
    company_phone: z.string().max(50).optional().or(z.literal('')),
    company_address: z.string().max(500).optional().or(z.literal('')),
    tax_number: z.string().max(50).optional().or(z.literal('')),
    accounting_module_enabled: z.boolean().optional(),
    hr_module_enabled: z.boolean().optional(),
    fiscal_year_start: z.string().optional().or(z.literal('')),
    time_zone: z.string().optional().or(z.literal('')),
    date_format: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
    sales_print_template: z.enum(['standard', 'statement']),
    purchase_print_template: z.enum(['standard', 'statement']),
    invoice_footer_note: z.string().max(300).optional().or(z.literal('')),
    default_dial_code: z.string().regex(/^\d{1,4}$/, messages.invalidDialCode).optional().or(z.literal('')),
  });
}

type SettingsFormData = z.infer<ReturnType<typeof createSettingsSchema>>;

export default function GeneralSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const { isRtl } = useDirection();
  const t = useTranslations('settings.general');
  const tPrinting = useTranslations('settings.invoicePrinting');

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  // Fetch settings
  const { data: settingsData, isLoading } = useTenantSettings();

  // Update mutation
  const updateMutation = useUpdateTenantSettings({
    onSuccess: () => {
      toast({
        title: t('toasts.updatedTitle'),
        description: t('toasts.updatedDescription'),
      });
    },
    onError: (error) => {
      toast({
        title: t('toasts.errorTitle'),
        description: error.message || t('toasts.updateFailed'),
        variant: 'destructive',
      });
    },
  });

  // Form
  const form = useForm<SettingsFormData>({
    resolver: zodResolver(createSettingsSchema({
      invalidEmail: t('validation.invalidEmail'),
      invalidDialCode: tPrinting('dialCodeInvalid'),
    })),
    values: {
      default_language: (settingsData?.data?.default_language || locale) as 'en' | 'ar',
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
      sales_print_template: printTemplateFromSettings(settingsData?.data, 'sale'),
      purchase_print_template: printTemplateFromSettings(settingsData?.data, 'purchase'),
      invoice_footer_note: settingsData?.data?.invoice_footer_note || '',
      default_dial_code: settingsData?.data?.default_dial_code || DEFAULT_DIAL_CODE,
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
        sales_print_template: data.sales_print_template,
        purchase_print_template: data.purchase_print_template,
        // Sent even when empty so clearing the note actually removes it.
        invoice_footer_note: data.invoice_footer_note?.trim() ?? '',
        default_dial_code: data.default_dial_code || undefined,
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
          aria-label={t('backAriaLabel')}
        >
          <BackIcon className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>{t('preferences.title')}</CardTitle>
              <CardDescription>{t('preferences.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="default_language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('preferences.language')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="en">{t('preferences.languageEn')}</SelectItem>
                        <SelectItem value="ar">{t('preferences.languageAr')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>{t('preferences.languageHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_theme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('preferences.theme')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="light">{t('preferences.themeLight')}</SelectItem>
                        <SelectItem value="dark">{t('preferences.themeDark')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>{t('preferences.themeHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('preferences.currency')}</FormLabel>
                    <FormControl>
                      <CurrencySelect
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>{t('preferences.currencyHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date_format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('preferences.dateFormat')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                    <FormDescription>{t('preferences.dateFormatHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('company.title')}</CardTitle>
              <CardDescription>{t('company.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TenantLogoField logoUrl={settingsData?.data?.logo_url} />

              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('company.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('company.namePlaceholder')} {...field} />
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
                    <FormLabel>{t('company.email')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t('company.emailPlaceholder')}
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
                    <FormLabel>{t('company.phone')}</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder={t('company.phonePlaceholder')}
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
                    <FormLabel>{t('company.address')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('company.addressPlaceholder')}
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
                    <FormLabel>{t('company.taxNumber')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('company.taxNumberPlaceholder')} {...field} />
                    </FormControl>
                    <FormDescription>{t('company.taxNumberHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Business Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>{t('business.title')}</CardTitle>
              <CardDescription>{t('business.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="fiscal_year_start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('business.fiscalYearStart')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('business.fiscalYearStartPlaceholder')} {...field} />
                    </FormControl>
                    <FormDescription>{t('business.fiscalYearStartHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time_zone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('business.timeZone')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('business.timeZonePlaceholder')} {...field} />
                    </FormControl>
                    <FormDescription>{t('business.timeZoneHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Module Activation */}
          <Card>
            <CardHeader>
              <CardTitle>{t('modules.title')}</CardTitle>
              <CardDescription>{t('modules.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="accounting_module_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t('modules.accounting')}</FormLabel>
                      <FormDescription>{t('modules.accountingHint')}</FormDescription>
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
                      <FormLabel className="text-base">{t('modules.hr')}</FormLabel>
                      <FormDescription>{t('modules.hrHint')}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Invoice Printing */}
          <Card>
            <CardHeader>
              <CardTitle>{tPrinting('title')}</CardTitle>
              <CardDescription>{tPrinting('description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {(['sales_print_template', 'purchase_print_template'] as const).map((name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {tPrinting(
                            name === 'sales_print_template' ? 'salesTemplate' : 'purchaseTemplate'
                          )}
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PRINT_TEMPLATES.map((template) => (
                              <SelectItem key={template} value={template}>
                                {tPrinting(
                                  template === 'standard' ? 'templateStandard' : 'templateStatement'
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{tPrinting('templateHint')}</p>

              <FormField
                control={form.control}
                name="invoice_footer_note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tPrinting('footerNote')}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        maxLength={300}
                        placeholder={tPrinting('footerNotePlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>{tPrinting('footerNoteHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_dial_code"
                render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel>{tPrinting('dialCode')}</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2" dir="ltr">
                        <span className="text-muted-foreground">+</span>
                        <Input inputMode="numeric" maxLength={4} placeholder="249" {...field} />
                      </div>
                    </FormControl>
                    <FormDescription>{tPrinting('dialCodeHint')}</FormDescription>
                    <FormMessage />
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
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('actions.saving')}
                </>
              ) : (
                <>
                  <Save className="me-2 h-4 w-4" />
                  {t('actions.save')}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
