'use client';

/**
 * Record Payment Dialog
 *
 * Compact modal opened right after a sales/purchase invoice is finalized, so the
 * user can immediately record the receipt/disbursement without leaving the flow.
 *
 * Design goals (vs. the full PaymentForm page):
 *  - No scroll: fields laid out in a 2-column grid.
 *  - Major fields pre-filled from the invoice (party, amount, currency, date) —
 *    the party is locked and shown as a read-only summary line.
 *  - The quick-fill fields (payment way, reference, note) are front and centre.
 *  - No bill-wise picker: the payment silently settles the just-saved invoice via
 *    a single allocation to it.
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { Save, Loader2, DollarSign } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CurrencySelect } from '@/components/forms/currency-select';
import { useToast } from '@/hooks/use-toast';
import { useBanks } from '@/hooks/use-banks';
import { useCreatePayment } from '@/hooks/use-payments';
import type { CreatePaymentInput, InvoiceWithRelations } from '@erp/shared';

const SENTINEL_CASH = '__cash__';

const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  currency: z.string().length(3),
  exchangeRate: z.coerce.number().positive().default(1),
  paymentDate: z.string().optional(),
  bankAccountId: z.string().uuid().nullable().optional().or(z.literal('')),
  reference: z.string().max(100).nullable().optional().or(z.literal('')),
  notes: z.string().max(500).nullable().optional().or(z.literal('')),
});

type RecordPaymentFormData = z.infer<typeof recordPaymentSchema>;

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The just-finalized invoice. Its partyId is assumed non-null. */
  invoice: InvoiceWithRelations;
  /** Called after the payment is saved OR the user skips — parent then redirects. */
  onDone: () => void;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
  onDone,
}: RecordPaymentDialogProps) {
  const t = useTranslations('payments.recordDialog');
  const tForm = useTranslations('payments.form');
  const { toast } = useToast();

  const { data: banks = [], isLoading: banksLoading } = useBanks();
  const createPayment = useCreatePayment();

  const isReceived = invoice.type === 'sale';
  const partyName = invoice.party?.name ?? '';

  const form = useForm<RecordPaymentFormData>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      amount: invoice.total,
      currency: invoice.currency,
      exchangeRate: invoice.exchangeRate,
      paymentDate: invoice.invoiceDate,
      bankAccountId: '',
      reference: '',
      notes: '',
    },
  });

  // Re-seed defaults whenever a new invoice drives the dialog open.
  useEffect(() => {
    if (open) {
      form.reset({
        amount: invoice.total,
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate,
        paymentDate: invoice.invoiceDate,
        bankAccountId: '',
        reference: '',
        notes: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice.id]);

  const handleSubmit = async (data: RecordPaymentFormData) => {
    if (!invoice.partyId) return;

    const payload: CreatePaymentInput = {
      partyId: invoice.partyId,
      type: isReceived ? 'received' : 'made',
      amount: data.amount,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      bankAccountId:
        data.bankAccountId && data.bankAccountId !== SENTINEL_CASH
          ? data.bankAccountId
          : null,
      reference: data.reference || null,
      notes: data.notes || null,
      paymentDate: data.paymentDate,
      // Auto-settle: allocate the whole payment to the invoice just saved.
      allocations: [{ invoice_id: invoice.id, amount: data.amount }],
    };

    try {
      await createPayment.mutateAsync(payload);
      toast({
        title: t('toastSuccess'),
        description: t('toastSuccessDesc', {
          amount: data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }),
          currency: data.currency,
        }),
      });
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toastError'),
        description: error instanceof Error ? error.message : t('toastErrorDesc'),
      });
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleSkip())}>
      <DialogContent
        className="sm:max-w-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {isReceived ? t('subtitleReceived') : t('subtitleMade')}
          </DialogDescription>
        </DialogHeader>

        {/* Read-only summary: locked party + invoice + total due */}
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <span className="text-muted-foreground">
                {isReceived ? tForm('customer') : tForm('supplier')}:
              </span>{' '}
              <span className="font-medium">{partyName}</span>
            </span>
            <span className="font-mono text-muted-foreground">
              {t('invoiceLabel', { number: invoice.invoiceNumber })}
            </span>
          </div>
          <div className="mt-1 text-muted-foreground">
            {t('totalDue', {
              amount: invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 }),
              currency: invoice.currency,
            })}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Row 1: amount | currency */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {tForm('amount')} <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={tForm('amountPlaceholder')}
                          className="ps-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm('currency')}</FormLabel>
                    <FormControl>
                      <CurrencySelect value={field.value} onValueChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 2: date | payment way */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm('paymentDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bankAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('paymentWay')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || SENTINEL_CASH}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={tForm('bankAccountPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={SENTINEL_CASH}>
                          {tForm('bankAccountCash')}
                        </SelectItem>
                        {banks
                          .filter((b) => b.is_active)
                          .map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              <span className="font-mono text-xs me-2">
                                {b.ledger?.code ?? ''}
                              </span>
                              {b.name}
                              {b.bank_name ? ` · ${b.bank_name}` : ''}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 3: reference | note */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm('reference')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tForm('referencePlaceholder')}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('note')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('notePlaceholder')}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                disabled={createPayment.isPending}
              >
                {t('skip')}
              </Button>
              <Button type="submit" disabled={createPayment.isPending || banksLoading} autoFocus>
                {createPayment.isPending ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t('saving')}
                  </>
                ) : (
                  <>
                    <Save className="me-2 h-4 w-4" />
                    {t('save')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
