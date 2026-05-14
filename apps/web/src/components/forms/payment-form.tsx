'use client';

/**
 * Payment Form Component
 *
 * Records a payment with:
 *  - Party selection (customer for "received", supplier for "made")
 *  - Bank/cash account routing (Phase 3 — replaces free-text payment_method)
 *  - Bill-wise allocation: split this payment across specific outstanding
 *    invoices, with the unallocated portion left as an advance
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  Payment,
  PaymentType,
  CreatePaymentInput,
  Party,
} from '@erp/shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Save, Loader2, DollarSign } from 'lucide-react';
import { useBanks } from '@/hooks/use-banks';
import { usePaymentOutstandingInvoices } from '@/hooks/use-payments';

const SENTINEL_CASH = '__cash__';

// =============================================================================
// FORM SCHEMA
// =============================================================================

const paymentFormSchema = z.object({
  partyId: z.string().uuid('Please select a party'),
  type: z.enum(['received', 'made']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  currency: z.string().length(3).default('USD'),
  exchangeRate: z.coerce.number().positive().default(1),
  bankAccountId: z.string().uuid().nullable().optional().or(z.literal('')),
  reference: z.string().max(100).nullable().optional().or(z.literal('')),
  notes: z.string().max(500).nullable().optional().or(z.literal('')),
  paymentDate: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentFormSchema>;

const CURRENCIES = [
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'GBP', label: 'British Pound (£)' },
  { value: 'EGP', label: 'Egyptian Pound (E£)' },
  { value: 'SAR', label: 'Saudi Riyal (﷼)' },
  { value: 'AED', label: 'UAE Dirham (د.إ)' },
];

interface PaymentFormProps {
  paymentType: PaymentType;
  parties?: Party[];
  selectedPartyId?: string;
  payment?: Payment;
  onSubmit: (data: CreatePaymentInput) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function PaymentForm({
  paymentType,
  parties = [],
  selectedPartyId,
  payment,
  onSubmit,
  onCancel,
  isLoading = false,
}: PaymentFormProps) {
  const tForm = useTranslations('payments.form');
  const tAlloc = useTranslations('payments.form.allocations');

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      partyId: selectedPartyId || '',
      type: paymentType,
      amount: 0,
      currency: 'USD',
      exchangeRate: 1,
      bankAccountId: '',
      reference: '',
      notes: '',
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });

  const watchedPartyId = form.watch('partyId');
  const watchedAmount = Number(form.watch('amount') || 0);

  // Allocation state: keyed by invoice_id. Stored outside react-hook-form
  // because the rows are driven by a server-fetched list, not a static field
  // set.
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  // Banks for the cash/bank dropdown.
  const { data: banks = [], isLoading: banksLoading } = useBanks();

  // Outstanding invoices for the currently-selected party. Only loaded when
  // the user is recording against an existing party — bill-wise picker is
  // hidden otherwise.
  const { data: outstandingInvoices = [], isLoading: outstandingLoading } =
    usePaymentOutstandingInvoices(watchedPartyId || undefined);

  // Reset allocations when the party changes so we don't carry stale picks.
  useEffect(() => {
    setAllocations({});
  }, [watchedPartyId]);

  // Populate from existing payment (edit flow).
  useEffect(() => {
    if (payment) {
      form.reset({
        partyId: payment.partyId,
        type: payment.type,
        amount: payment.amount,
        currency: payment.currency,
        exchangeRate: payment.exchangeRate,
        bankAccountId: '',
        reference: payment.reference || '',
        notes: payment.notes || '',
        paymentDate: payment.paymentDate,
      });
    }
  }, [payment, form]);

  useEffect(() => {
    if (selectedPartyId && !payment) {
      form.setValue('partyId', selectedPartyId);
    }
  }, [selectedPartyId, payment, form]);

  const totalAllocated = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0),
    [allocations]
  );
  const advanceAmount = Math.max(0, watchedAmount - totalAllocated);
  const allocationsExceed = totalAllocated > watchedAmount + 0.01;

  const handleAllocationChange = (invoiceId: string, raw: string, max: number) => {
    let amount = Number(raw);
    if (isNaN(amount) || amount < 0) amount = 0;
    if (amount > max) amount = max; // Cap at outstanding.
    setAllocations((prev) => {
      const next = { ...prev };
      if (amount === 0) {
        delete next[invoiceId];
      } else {
        next[invoiceId] = Math.round(amount * 100) / 100;
      }
      return next;
    });
  };

  /**
   * Fill the payment amount FIFO-style across outstanding invoices: clear
   * existing allocations first, then walk oldest → newest applying each
   * invoice's outstanding balance until the payment amount is exhausted.
   */
  const handleAutoFill = () => {
    if (!watchedAmount || outstandingInvoices.length === 0) return;
    let remaining = watchedAmount;
    const fresh: Record<string, number> = {};
    for (const inv of outstandingInvoices) {
      if (remaining <= 0.01) break;
      const apply = Math.min(inv.outstanding, remaining);
      if (apply > 0) {
        fresh[inv.invoice_id] = Math.round(apply * 100) / 100;
        remaining -= apply;
      }
    }
    setAllocations(fresh);
  };

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<CreatePaymentInput | null>(null);

  const handleSubmit = async (data: PaymentFormData) => {
    const allocationRows = Object.entries(allocations)
      .filter(([, amt]) => amt > 0)
      .map(([invoice_id, amount]) => ({ invoice_id, amount }));

    const submitData: CreatePaymentInput = {
      partyId: data.partyId,
      type: data.type,
      amount: data.amount,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      bankAccountId: data.bankAccountId && data.bankAccountId !== SENTINEL_CASH
        ? data.bankAccountId
        : null,
      reference: data.reference || null,
      notes: data.notes || null,
      paymentDate: data.paymentDate,
      allocations: allocationRows.length > 0 ? allocationRows : undefined,
    };

    setPendingData(submitData);
    setShowConfirm(true);
  };

  const confirmPayment = useCallback(async () => {
    if (!pendingData) return;
    setShowConfirm(false);
    await onSubmit(pendingData);
    setPendingData(null);
  }, [pendingData, onSubmit]);

  const paymentLabel = paymentType === 'received' ? 'Payment Received' : 'Payment Made';
  const partyTypeLabel = paymentType === 'received' ? 'Customer' : 'Supplier';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{paymentLabel}</CardTitle>
            <CardDescription>
              Record a payment {paymentType === 'received' ? 'from' : 'to'} a{' '}
              {partyTypeLabel.toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="partyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {partyTypeLabel} <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${partyTypeLabel.toLowerCase()}`} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {parties.map((party) => (
                        <SelectItem key={party.id} value={party.id}>
                          {party.name}
                          {party.balance !== 0 && (
                            <span
                              className={`ml-2 text-sm ${party.balance > 0 ? 'text-amber-600' : 'text-green-600'}`}
                            >
                              ({party.balance > 0
                                ? `Owes: ${Math.abs(party.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : `Credit: ${Math.abs(party.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Amount <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency.value} value={currency.value}>
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exchangeRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exchange Rate</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.000001"
                        min="0"
                        placeholder="1.0"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Rate to USD</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="paymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phase 3: bank/cash account dropdown replaces free-text payment_method */}
            <FormField
              control={form.control}
              name="bankAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tForm('bankAccountLabel')}</FormLabel>
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
                            <span className="font-mono text-xs mr-2">
                              {b.ledger?.code ?? ''}
                            </span>
                            {b.name}
                            {b.bank_name ? ` · ${b.bank_name}` : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {!banksLoading && banks.length === 0 && (
                    <FormDescription>{tForm('noBanksHint')}</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Check number, transaction ID, etc."
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
                  <FormLabel>
                    Notes{' '}
                    <span className="text-muted-foreground font-normal">(Optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this payment"
                      className="min-h-[80px]"
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

        {/* Phase 3: bill-wise allocation */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle>{tAlloc('title')}</CardTitle>
                <CardDescription>{tAlloc('subtitle')}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoFill}
                  disabled={!watchedAmount || outstandingInvoices.length === 0}
                >
                  {tAlloc('autoFill')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllocations({})}
                  disabled={Object.keys(allocations).length === 0}
                >
                  {tAlloc('clearAll')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!watchedPartyId ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {tAlloc('selectParty')}
              </p>
            ) : outstandingLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : outstandingInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {tAlloc('empty')}
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tAlloc('invoice')}</TableHead>
                      <TableHead>{tAlloc('date')}</TableHead>
                      <TableHead className="text-right">{tAlloc('total')}</TableHead>
                      <TableHead className="text-right">
                        {tAlloc('outstanding')}
                      </TableHead>
                      <TableHead className="text-right w-40">
                        {tAlloc('applied')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outstandingInvoices.map((inv) => (
                      <TableRow key={inv.invoice_id}>
                        <TableCell className="font-mono text-sm">
                          {inv.invoice_number}
                        </TableCell>
                        <TableCell className="text-sm">
                          {inv.invoice_date}
                          <span className="text-xs text-muted-foreground ml-2">
                            ({tAlloc('days', { count: inv.days_outstanding })})
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {inv.total.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {inv.outstanding.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            max={inv.outstanding}
                            value={allocations[inv.invoice_id] ?? ''}
                            placeholder="0.00"
                            className="text-right font-mono"
                            onChange={(e) =>
                              handleAllocationChange(
                                inv.invoice_id,
                                e.target.value,
                                inv.outstanding
                              )
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                  <div>
                    {tAlloc('summary', {
                      applied: totalAllocated.toFixed(2),
                      amount: watchedAmount.toFixed(2),
                    })}
                  </div>
                  <div className="font-medium">
                    {advanceAmount > 0.01 && (
                      <span className="text-amber-600">
                        {tAlloc('advance', { amount: advanceAmount.toFixed(2) })}
                      </span>
                    )}
                    {allocationsExceed && (
                      <span className="text-red-600">{tAlloc('exceeds')}</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading || allocationsExceed}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Record Payment
              </>
            )}
          </Button>
        </div>
      </form>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingData && (
                <>
                  You are about to record a{' '}
                  {pendingData.type === 'received' ? 'received' : 'made'} payment of{' '}
                  {pendingData.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}{' '}
                  {pendingData.currency}. This will update the party balance immediately.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPayment}>Record Payment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
