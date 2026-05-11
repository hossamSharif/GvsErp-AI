'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  ArrowLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/components/ui/use-toast';
import { usePayment, useDeletePayment } from '@/hooks/use-payments';

export default function PaymentDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const id = params.id as string;
  const { toast } = useToast();
  const t = useTranslations('payments.details');
  const tList = useTranslations('payments.list');
  const tCommon = useTranslations('common');
  const intlLocale = useLocale();

  const { data, isLoading, error } = usePayment(id);
  const payment = data?.data;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deleteMutation = useDeletePayment({
    onSuccess: () => {
      toast({
        title: tList('toast.deleted'),
        description: tList('toast.deletedDesc'),
      });
      router.push(`/${locale}/payments`);
    },
    onError: (err) => {
      toast({
        title: tCommon('error'),
        description: err.message || tList('toast.deleteError'),
        variant: 'destructive',
      });
    },
  });

  const confirmDelete = useCallback(() => {
    if (payment) {
      deleteMutation.mutate({ id: payment.id, partyId: payment.partyId });
    }
  }, [deleteMutation, payment]);

  const formatCurrency = useCallback(
    (amount: number, currency: string) =>
      new Intl.NumberFormat(intlLocale === 'ar' ? 'ar' : 'en-US', {
        style: 'currency',
        currency: currency || 'USD',
      }).format(amount),
    [intlLocale]
  );

  const formatDate = useCallback(
    (date: string) =>
      new Date(date).toLocaleDateString(intlLocale === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [intlLocale]
  );

  const formatDateTime = useCallback(
    (date: string) =>
      new Date(date).toLocaleString(intlLocale === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [intlLocale]
  );

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild aria-label={t('back')}>
            <Link href={`/${locale}/payments`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            {payment?.reference && (
              <p className="text-muted-foreground font-mono">{payment.reference}</p>
            )}
          </div>
        </div>
        {payment && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/${locale}/payments/${payment.id}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {t('edit')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('delete')}
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error || !payment ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('notFound')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error?.message || t('notFoundDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('sections.summary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label={t('fields.type')}>
                <Badge variant={payment.type === 'received' ? 'default' : 'secondary'}>
                  {payment.type === 'received' ? (
                    <>
                      <ArrowDownCircle className="mr-1 h-3 w-3" />
                      {tList('type.received')}
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="mr-1 h-3 w-3" />
                      {tList('type.made')}
                    </>
                  )}
                </Badge>
              </Row>
              <Row label={t('fields.amount')}>
                <span className="font-semibold">
                  {formatCurrency(payment.amount, payment.currency)}
                </span>
              </Row>
              <Row label={t('fields.currency')}>{payment.currency}</Row>
              {payment.exchangeRate !== 1 && (
                <Row label={t('fields.exchangeRate')}>{payment.exchangeRate}</Row>
              )}
              <Row label={t('fields.paymentDate')}>{formatDate(payment.paymentDate)}</Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('sections.party')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label={t('fields.partyName')}>
                <Link
                  className="text-primary hover:underline"
                  href={`/${locale}/${payment.party.type === 'customer' ? 'customers' : 'suppliers'}/${payment.party.id}`}
                >
                  {payment.party.name}
                </Link>
              </Row>
              <Row label={t('fields.partyType')}>
                {tList(`type.${payment.party.type}` as never)}
              </Row>
              <Row label={t('fields.partyBalance')}>
                <span className={payment.party.balance > 0 ? 'text-amber-600' : 'text-green-600'}>
                  {formatCurrency(payment.party.balance, payment.currency)}
                </span>
              </Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('sections.details')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label={t('fields.reference')}>
                <span className="font-mono">{payment.reference || '—'}</span>
              </Row>
              <Row label={t('fields.paymentMethod')}>
                <span className="capitalize">
                  {payment.paymentMethod?.replace('_', ' ') || '—'}
                </span>
              </Row>
              <Row label={t('fields.createdAt')}>{formatDateTime(payment.createdAt)}</Row>
              {payment.creator && (
                <Row label={t('fields.createdBy')}>
                  {payment.creator.fullName || payment.creator.email}
                </Row>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('sections.linkedInvoice')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {payment.invoice ? (
                <>
                  <Row label={t('fields.invoiceNumber')}>
                    <span className="font-mono">{payment.invoice.invoiceNumber}</span>
                  </Row>
                  <Row label={t('fields.invoiceTotal')}>
                    {formatCurrency(payment.invoice.total, payment.currency)}
                  </Row>
                  <Row label={t('fields.invoiceStatus')}>
                    <Badge variant="outline" className="capitalize">
                      {payment.invoice.status}
                    </Badge>
                  </Row>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t('fields.noLinkedInvoice')}</p>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{t('sections.notes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {payment.notes || t('noNotes')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tList('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tList('deleteDialog.description', {
                reference: payment?.reference || payment?.id?.slice(0, 8) || '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
