'use client';

/**
 * Item Expiry Report Page
 *
 * Lists items expiring within a configurable threshold, color-coded by severity.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useExpiryReport } from '@/hooks/use-expiry';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { ExpirySeverity } from '@erp/shared';
import { ArrowLeft, CalendarClock } from 'lucide-react';

const SEVERITY_VARIANT: Record<ExpirySeverity, 'destructive' | 'default' | 'secondary'> = {
  expired: 'destructive',
  critical: 'destructive',
  warning: 'secondary',
};

export default function ItemExpiryReportPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('items.expiryReport');

  const [daysThreshold, setDaysThreshold] = useState(30);
  const [severity, setSeverity] = useState<ExpirySeverity | 'all'>('all');

  const { data, isLoading, error } = useExpiryReport({
    daysThreshold,
    severity: severity === 'all' ? undefined : severity,
  });
  const alerts = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('backAriaLabel')}
          onClick={() => router.push(`/${locale}/items`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              {t('title')}
            </CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={severity}
              onValueChange={(value) => setSeverity(value as ExpirySeverity | 'all')}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('severityFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('severityOptions.all')}</SelectItem>
                <SelectItem value="expired">{t('status.expired')}</SelectItem>
                <SelectItem value="critical">{t('status.critical')}</SelectItem>
                <SelectItem value="warning">{t('status.warning')}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(daysThreshold)}
              onValueChange={(value) => setDaysThreshold(Number(value))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('daysThreshold')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t('daysThresholdOptions.7')}</SelectItem>
                <SelectItem value="30">{t('daysThresholdOptions.30')}</SelectItem>
                <SelectItem value="60">{t('daysThresholdOptions.60')}</SelectItem>
                <SelectItem value="90">{t('daysThresholdOptions.90')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <p className="text-destructive text-center py-8">{t('errorLoading')}</p>
          ) : alerts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.item')}</TableHead>
                  <TableHead>{t('columns.sku')}</TableHead>
                  <TableHead>{t('columns.expiryDate')}</TableHead>
                  <TableHead>{t('columns.daysRemaining')}</TableHead>
                  <TableHead>{t('columns.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.itemId}>
                    <TableCell className="font-medium">{alert.itemName}</TableCell>
                    <TableCell className="font-mono text-sm">{alert.itemSku || '-'}</TableCell>
                    <TableCell>{alert.expiryDate}</TableCell>
                    <TableCell>{alert.daysUntilExpiry}</TableCell>
                    <TableCell>
                      <Badge variant={SEVERITY_VARIANT[alert.severity]}>
                        {t(`status.${alert.severity}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
