'use client';

/**
 * Payment Form Component
 *
 * Form for recording payments with:
 * - Party selection
 * - Payment details (amount, method, reference)
 * - Optional invoice linking
 */

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
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

// =============================================================================
// FORM SCHEMA
// =============================================================================

const paymentFormSchema = z.object({
  partyId: z.string().uuid('Please select a party'),
  type: z.enum(['received', 'made']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  currency: z.string().length(3).default('USD'),
  exchangeRate: z.coerce.number().positive().default(1),
  paymentMethod: z.string().max(50).nullable().optional().or(z.literal('')),
  reference: z.string().max(100).nullable().optional().or(z.literal('')),
  invoiceId: z.string().uuid().nullable().optional().or(z.literal('')),
  notes: z.string().max(500).nullable().optional().or(z.literal('')),
  paymentDate: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentFormSchema>;

// =============================================================================
// CONSTANTS
// =============================================================================

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'other', label: 'Other' },
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

interface PaymentFormProps {
  /** Payment type - received or made */
  paymentType: PaymentType;
  /** Available parties (filtered by type) */
  parties?: Party[];
  /** Pre-selected party ID */
  selectedPartyId?: string;
  /** Existing payment data for editing */
  payment?: Payment;
  /** Submit handler */
  onSubmit: (data: CreatePaymentInput) => Promise<void>;
  /** Cancel handler */
  onCancel?: () => void;
  /** Loading state */
  isLoading?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PaymentForm({
  paymentType,
  parties = [],
  selectedPartyId,
  payment,
  onSubmit,
  onCancel,
  isLoading = false,
}: PaymentFormProps) {
  // Form setup
  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      partyId: selectedPartyId || '',
      type: paymentType,
      amount: 0,
      currency: 'USD',
      exchangeRate: 1,
      paymentMethod: '',
      reference: '',
      invoiceId: '',
      notes: '',
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });

  // Populate form with existing data
  useEffect(() => {
    if (payment) {
      form.reset({
        partyId: payment.partyId,
        type: payment.type,
        amount: payment.amount,
        currency: payment.currency,
        exchangeRate: payment.exchangeRate,
        paymentMethod: payment.paymentMethod || '',
        reference: payment.reference || '',
        invoiceId: payment.invoiceId || '',
        notes: payment.notes || '',
        paymentDate: payment.paymentDate,
      });
    }
  }, [payment, form]);

  // Update party ID if prop changes
  useEffect(() => {
    if (selectedPartyId && !payment) {
      form.setValue('partyId', selectedPartyId);
    }
  }, [selectedPartyId, payment, form]);

  // Confirmation state
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<CreatePaymentInput | null>(null);

  // Handle form submission — show confirmation first
  const handleSubmit = async (data: PaymentFormData) => {
    const submitData: CreatePaymentInput = {
      partyId: data.partyId,
      type: data.type,
      amount: data.amount,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      paymentMethod: data.paymentMethod || null,
      reference: data.reference || null,
      invoiceId: data.invoiceId || null,
      notes: data.notes || null,
      paymentDate: data.paymentDate,
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
        {/* Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle>{paymentLabel}</CardTitle>
            <CardDescription>
              Record a payment {paymentType === 'received' ? 'from' : 'to'} a {partyTypeLabel.toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Party Selection */}
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
                            <span className={`ml-2 text-sm ${party.balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
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

            {/* Amount */}
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

            {/* Currency and Exchange Rate */}
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

            {/* Payment Date */}
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

            {/* Payment Method */}
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reference */}
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
                  <FormDescription>
                    Optional reference for this payment
                  </FormDescription>
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
                  <FormLabel>Notes <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
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

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
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

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingData && (
                <>
                  You are about to record a {pendingData.type === 'received' ? 'received' : 'made'} payment
                  of {pendingData.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {pendingData.currency}.
                  This will update the party balance immediately.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPayment}>
              Record Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
