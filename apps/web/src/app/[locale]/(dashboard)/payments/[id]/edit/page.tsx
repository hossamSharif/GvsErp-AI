'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { usePayment, useUpdatePayment } from '@/hooks/use-payments';
import type { UpdatePaymentInput } from '@erp/shared';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'other', label: 'Other' },
];
const NONE_VALUE = '__none__';

export default function EditPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const id = params.id as string;
  const intlLocale = useLocale();
  const { toast } = useToast();
  const t = useTranslations('payments.edit');
  const tList = useTranslations('payments.list');
  const tCommon = useTranslations('common');

  const { data, isLoading, error } = usePayment(id);
  const payment = data?.data;

  const [paymentMethod, setPaymentMethod] = useState<string>(NONE_VALUE);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (payment) {
      setPaymentMethod(payment.paymentMethod || NONE_VALUE);
      setReference(payment.reference || '');
      setNotes(payment.notes || '');
    }
  }, [payment]);

  const updatePayment = useUpdatePayment({
    onSuccess: () => {
      toast({
        title: t('toast.updated'),
        description: t('toast.updatedDesc'),
      });
      router.push(`/${locale}/payments/${id}`);
    },
    onError: (err) => {
      toast({
        title: tCommon('error'),
        description: err.message || t('toast.updateError'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!payment) return;
      const input: UpdatePaymentInput = {
        paymentMethod: paymentMethod === NONE_VALUE ? null : paymentMethod,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      };
      updatePayment.mutate({ id, input, partyId: payment.partyId });
    },
    [paymentMethod, reference, notes, updatePayment, id, payment]
  );

  const handleCancel = useCallback(() => {
    router.push(`/${locale}/payments/${id}`);
  }, [router, locale, id]);

  const formatCurrency = useCallback(
    (amount: number, currency: string) =>
      new Intl.NumberFormat(intlLocale === 'ar' ? 'ar' : 'en-US', {
        style: 'currency',
        currency: currency || 'USD',
      }).format(amount),
    [intlLocale]
  );

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label={t('back')}>
          <Link href={`/${locale}/payments/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error || !payment ? (
        <Card>
          <CardHeader>
            <CardTitle>{tList('errorLoading')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error?.message || t('toast.updateError')}</p>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{tList('type.' + payment.type as any)}</CardTitle>
              <CardDescription>
                {payment.party.name} · {formatCurrency(payment.amount, payment.currency)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">{tList('columns.method')}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="paymentMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>—</SelectItem>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">{tList('columns.reference')}</Label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{tList('columns.notes')}</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={updatePayment.isPending}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={updatePayment.isPending}>
              {updatePayment.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {tCommon('save')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
