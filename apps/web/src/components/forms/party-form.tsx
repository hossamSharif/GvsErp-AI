'use client';

/**
 * Party Form Component
 *
 * Form for creating and editing parties (customers/suppliers) with:
 * - Basic info (name, email, phone)
 * - Contact details (address, tax number)
 * - Notes and status
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type {
  Party,
  PartyType,
  CreatePartyInput,
  UpdatePartyInput,
} from '@erp/shared';
import { naturalDirection, fromSignedOpeningBalance } from '@erp/shared';
import { Save, Loader2, AlertTriangle } from 'lucide-react';

// =============================================================================
// FORM SCHEMA
// =============================================================================

const partyFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  email: z.string().email('Invalid email format').max(255).nullable().optional().or(z.literal('')),
  phone: z.string().max(50).nullable().optional().or(z.literal('')),
  address: z.string().max(500).nullable().optional().or(z.literal('')),
  taxNumber: z.string().max(50).nullable().optional().or(z.literal('')),
  notes: z.string().max(2000).nullable().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  // Opening balance is captured as a positive magnitude plus a side, because
  // which side counts as "positive" flips between customers and suppliers.
  // The sign is applied server-side via toSignedOpeningBalance.
  openingBalanceAmount: z.coerce
    .number({ invalid_type_error: 'Opening balance must be a number' })
    .min(0, 'Opening balance cannot be negative')
    .optional(),
  openingBalanceDirection: z.enum(['debit', 'credit']),
  openingBalanceDate: z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (!data.openingBalanceAmount) return;
  if (!data.openingBalanceDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['openingBalanceDate'],
      message: 'As-of date is required when an opening balance is entered',
    });
  } else if (data.openingBalanceDate > new Date().toISOString().slice(0, 10)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['openingBalanceDate'],
      message: 'Opening balance date cannot be in the future',
    });
  }
});

type PartyFormData = z.infer<typeof partyFormSchema>;

/** Today as YYYY-MM-DD, for the date input's default and max */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// =============================================================================
// PROPS
// =============================================================================

interface PartyFormProps {
  /** Party type - customer or supplier */
  partyType: PartyType;
  /** Existing party data for editing */
  party?: Party;
  /** Submit handler */
  onSubmit: (data: CreatePartyInput | UpdatePartyInput) => Promise<void>;
  /** Cancel handler */
  onCancel?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Mode: create or edit */
  mode?: 'create' | 'edit';
  /**
   * Whether the party already has invoices or payments. Only used to warn that
   * changing the opening balance restates the books — it never blocks editing.
   */
  hasTransactions?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PartyForm({
  partyType,
  party,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
  hasTransactions = false,
}: PartyFormProps) {
  const t = useTranslations('parties.form');

  // Form setup
  const form = useForm<PartyFormData>({
    resolver: zodResolver(partyFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      taxNumber: '',
      notes: '',
      isActive: true,
      openingBalanceAmount: undefined,
      openingBalanceDirection: naturalDirection(partyType),
      openingBalanceDate: todayIso(),
    },
  });

  // Populate form with existing data
  useEffect(() => {
    if (party && mode === 'edit') {
      // The stored value is signed; split it back into amount + side.
      const opening = fromSignedOpeningBalance(partyType, party.openingBalance ?? 0);
      form.reset({
        name: party.name,
        email: party.email || '',
        phone: party.phone || '',
        address: party.address || '',
        taxNumber: party.taxNumber || '',
        notes: party.notes || '',
        isActive: party.isActive,
        openingBalanceAmount: opening.amount || undefined,
        openingBalanceDirection: opening.direction,
        openingBalanceDate: party.openingBalanceDate || todayIso(),
      });
    }
  }, [party, mode, partyType, form]);

  // Handle form submission
  const handleSubmit = async (data: PartyFormData) => {
    // Convert empty strings to null
    const submitData = {
      ...(mode === 'create' && { type: partyType }),
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      taxNumber: data.taxNumber || null,
      notes: data.notes || null,
      ...(mode === 'edit' && { isActive: data.isActive }),
      openingBalance: data.openingBalanceAmount || 0,
      openingBalanceDirection: data.openingBalanceDirection,
      openingBalanceDate: data.openingBalanceDate || null,
    };

    await onSubmit(submitData as CreatePartyInput | UpdatePartyInput);
  };

  const isCustomer = partyType === 'customer';
  const namePlaceholder = isCustomer ? t('namePlaceholderCustomer') : t('namePlaceholderSupplier');
  const sectionDesc =
    mode === 'create'
      ? isCustomer
        ? t('createCustomerDesc')
        : t('createSupplierDesc')
      : isCustomer
        ? t('updateCustomerDesc')
        : t('updateSupplierDesc');
  const statusDesc = isCustomer ? t('manageCustomerStatus') : t('manageSupplierStatus');
  const notesDesc = isCustomer ? t('notesDescCustomer') : t('notesDescSupplier');
  const activeDesc = isCustomer ? t('activeDescCustomer') : t('activeDescSupplier');
  const submitLabel =
    mode === 'create'
      ? isCustomer
        ? t('createCustomer')
        : t('createSupplier')
      : isCustomer
        ? t('updateCustomer')
        : t('updateSupplier');
  const submittingLabel = mode === 'create' ? t('creating') : t('updating');

  // Which side of the ledger means what depends on the party type: a customer
  // is a receivable (debit-natured), a supplier a payable (credit-natured).
  const debitDesc = isCustomer
    ? t('openingBalanceDebitDescCustomer')
    : t('openingBalanceDebitDescSupplier');
  const creditDesc = isCustomer
    ? t('openingBalanceCreditDescCustomer')
    : t('openingBalanceCreditDescSupplier');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('basicInformation')}</CardTitle>
            <CardDescription>{sectionDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('nameLabel')} <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={namePlaceholder} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('emailLabel')}{' '}
                    <span className="text-muted-foreground font-normal">{t('optionalLabel')}</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t('emailPlaceholder')}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>{t('emailDesc')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('phoneLabel')}{' '}
                    <span className="text-muted-foreground font-normal">{t('optionalLabel')}</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder={t('phonePlaceholder')}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Additional Details */}
        <Card>
          <CardHeader>
            <CardTitle>{t('additionalDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Address */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('addressLabel')}{' '}
                    <span className="text-muted-foreground font-normal">{t('optionalLabel')}</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('addressPlaceholder')}
                      className="min-h-[80px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tax Number */}
            <FormField
              control={form.control}
              name="taxNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('taxNumberLabel')}{' '}
                    <span className="text-muted-foreground font-normal">{t('optionalLabel')}</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('taxNumberPlaceholder')}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>{t('taxNumberDesc')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('notesLabel')}{' '}
                    <span className="text-muted-foreground font-normal">{t('optionalLabel')}</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('notesPlaceholder')}
                      className="min-h-[100px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>{notesDesc}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Opening Balance */}
        <Card>
          <CardHeader>
            <CardTitle>{t('openingBalanceSection')}</CardTitle>
            <CardDescription>{t('openingBalanceDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === 'edit' && hasTransactions && (
              <Alert variant="default" className="border-amber-500/50 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{t('openingBalanceTxnWarning')}</AlertDescription>
              </Alert>
            )}

            {/* Amount */}
            <FormField
              control={form.control}
              name="openingBalanceAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('openingBalanceAmountLabel')}{' '}
                    <span className="text-muted-foreground font-normal">{t('optionalLabel')}</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder="0.00"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Direction */}
            <FormField
              control={form.control}
              name="openingBalanceDirection"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('openingBalanceDirectionLabel')}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col gap-3 sm:flex-row sm:gap-6"
                    >
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="debit" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {t('openingBalanceDebit')}
                          <span className="text-muted-foreground block text-xs">{debitDesc}</span>
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="credit" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {t('openingBalanceCredit')}
                          <span className="text-muted-foreground block text-xs">{creditDesc}</span>
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* As-of date */}
            <FormField
              control={form.control}
              name="openingBalanceDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('openingBalanceDateLabel')}</FormLabel>
                  <FormControl>
                    <Input type="date" max={todayIso()} {...field} value={field.value || ''} />
                  </FormControl>
                  <FormDescription>{t('openingBalanceDateDesc')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Status (Edit Mode Only) */}
        {mode === 'edit' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('statusSection')}</CardTitle>
              <CardDescription>{statusDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t('activeLabel')}</FormLabel>
                      <FormDescription>{activeDesc}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              {t('cancel')}
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin rtl:ml-2 rtl:mr-0" />
                {submittingLabel}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
