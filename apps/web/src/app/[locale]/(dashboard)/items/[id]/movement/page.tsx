'use client';

/**
 * Item Movement Report
 *
 * Per-item stock ledger: where this item's stock came from and went, at what
 * prices, plus the profitability KPIs. Rows backed by an invoice are clickable
 * and navigate to that sales/purchase invoice so the user can act on it.
 *
 * Online-only — the report is server-derived and would go stale against the
 * offline outbox, so it is wrapped in OnlineOnlyGuard and its endpoint is
 * deliberately absent from lib/offline/routes.ts.
 */

import { useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useReactToPrint } from 'react-to-print';
import { useItemMovement } from '@/hooks/use-items';
import { usePrefetchInvoice } from '@/hooks/use-invoices';
import { useActiveWarehouses } from '@/hooks/use-warehouses';
import { OnlineOnlyGuard } from '@/components/pwa/online-only-guard';
import { ItemMovementPrintStyles } from '@/components/reports/item-movement-print-styles';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { ItemMovementRow, ItemMovementType } from '@erp/shared';
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  Pencil,
  Printer,
  AlertTriangle,
} from 'lucide-react';

// =============================================================================
// DATE HELPERS
// =============================================================================

function toIso(d: Date): string {
  return d.toISOString().split('T')[0];
}

function todayIso(): string {
  return toIso(new Date());
}

function startOfMonthIso(): string {
  const d = new Date();
  return toIso(new Date(d.getFullYear(), d.getMonth(), 1));
}

function startOfYearIso(): string {
  return toIso(new Date(new Date().getFullYear(), 0, 1));
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toIso(d);
}

/** Movement kinds that never have an invoice to open. */
const NON_INVOICE_TYPES: ItemMovementType[] = [
  'opening',
  'transfer_in',
  'transfer_out',
  'adjustment',
];

const BADGE_CLASSES: Record<ItemMovementType, string> = {
  sale: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  sale_return: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  purchase: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  purchase_return: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  transfer_in: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  transfer_out: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  opening: 'bg-transparent text-muted-foreground border border-border',
  adjustment: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
};

// =============================================================================
// PRESENTATIONAL BITS
// =============================================================================

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
  badge?: string;
}

/** Matches the KpiCard shape used by the daily-journal report. */
function KpiCard({ label, value, sub, valueClassName, badge }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          {badge && (
            <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
              {badge}
            </Badge>
          )}
        </div>
        <p
          className={cn(
            'text-lg sm:text-xl md:text-2xl font-bold font-mono break-all',
            valueClassName
          )}
        >
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function InsightItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium font-mono break-all">{value}</p>
    </div>
  );
}

// =============================================================================
// PAGE
// =============================================================================

export default function ItemMovementPage() {
  return (
    <OnlineOnlyGuard moduleName="Item movement report">
      <ItemMovementReportView />
    </OnlineOnlyGuard>
  );
}

function ItemMovementReportView() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const itemId = params.id as string;

  const t = useTranslations('itemMovement');
  const tCommon = useTranslations('common');

  const [dateFrom, setDateFrom] = useState(startOfMonthIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [warehouseId, setWarehouseId] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<'all' | 'sales' | 'purchases'>('all');

  const prefetchInvoice = usePrefetchInvoice();
  const { data: warehousesData } = useActiveWarehouses();
  const warehouses = warehousesData?.data ?? [];

  const { data, isLoading, error } = useItemMovement(itemId, {
    dateFrom,
    dateTo,
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
  });

  const report = data?.data;

  const nf = useMemo(
    () => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    []
  );
  const qf = useMemo(
    () => new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 }),
    []
  );

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Item-Movement-${report?.item.sku || report?.item.name || itemId}-${dateFrom}_${dateTo}`,
    pageStyle: '@page { size: A4 landscape; margin: 10mm 12mm; }',
    removeAfterPrint: true,
  });

  const visibleRows: ItemMovementRow[] = useMemo(() => {
    const rows = report?.movements ?? [];
    if (kindFilter === 'sales') {
      return rows.filter((r) => r.movementType === 'sale' || r.movementType === 'sale_return');
    }
    if (kindFilter === 'purchases') {
      return rows.filter(
        (r) => r.movementType === 'purchase' || r.movementType === 'purchase_return'
      );
    }
    return rows;
  }, [report, kindFilter]);

  // Footer totals follow whatever the user is currently looking at, so a
  // filtered view still foots correctly.
  const visibleTotals = useMemo(
    () =>
      visibleRows.reduce(
        (acc, r) => ({
          qtyIn: acc.qtyIn + r.quantityIn,
          qtyOut: acc.qtyOut + r.quantityOut,
          net: acc.net + (r.lineNet ?? 0),
        }),
        { qtyIn: 0, qtyOut: 0, net: 0 }
      ),
    [visibleRows]
  );

  const openInvoice = (row: ItemMovementRow) => {
    if (!row.invoiceId || !row.invoiceType) return;
    const segment = row.invoiceType === 'purchase' ? 'purchases' : 'sales';
    router.push(`/${locale}/${segment}/${row.invoiceId}`);
  };

  const applyPreset = (preset: 'month' | 'last30' | 'year') => {
    if (preset === 'month') setDateFrom(startOfMonthIso());
    if (preset === 'last30') setDateFrom(daysAgoIso(30));
    if (preset === 'year') setDateFrom(startOfYearIso());
    setDateTo(todayIso());
  };

  const fmtDate = (iso: string) => (iso ? iso.split('T')[0] : '—');
  const fmtMoney = (n: number | null) => (n === null ? '—' : nf.format(n));
  const fmtQty = (n: number) => qf.format(n);

  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <p className="text-destructive">{error.message || t('loadFailed')}</p>
        <Button onClick={() => router.push(`/${locale}/items`)}>{t('backToItems')}</Button>
      </div>
    );
  }

  const kpis = report?.kpis;

  return (
    <div className="space-y-6">
      <ItemMovementPrintStyles />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('backAriaLabel')}
            onClick={() => router.push(`/${locale}/items`)}
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight break-words">
              {report?.item.name ?? tCommon('loading')}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {report?.item.sku && <Badge variant="secondary">{report.item.sku}</Badge>}
              {report?.item.barcode && (
                <Badge variant="outline">{report.item.barcode}</Badge>
              )}
              {report?.item.categoryName && (
                <Badge variant="outline">{report.item.categoryName}</Badge>
              )}
              {report?.item.unitOfMeasure && (
                <Badge variant="outline">{report.item.unitOfMeasure}</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1">{t('description')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => router.push(`/${locale}/items/${itemId}`)}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" /> {t('editItem')}
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> {t('print')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="im-warehouse">{t('warehouse')}</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger id="im-warehouse" className="w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allWarehouses')}</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="im-from">{t('dateFrom')}</Label>
          <Input
            id="im-from"
            type="date"
            className="w-full sm:w-40"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="im-to">{t('dateTo')}</Label>
          <Input
            id="im-to"
            type="date"
            className="w-full sm:w-40"
            value={dateTo}
            min={dateFrom}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button type="button" variant="outline" size="sm" onClick={() => applyPreset('month')}>
            {t('presets.thisMonth')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => applyPreset('last30')}>
            {t('presets.last30')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => applyPreset('year')}>
            {t('presets.thisYear')}
          </Button>
        </div>
      </div>

      {isLoading || !report || !kpis ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div ref={printRef} className="item-movement-print-root space-y-6">
          {/* Print-only heading */}
          <div className="hidden print:block">
            <h1 className="text-xl font-bold">
              {report.item.name}
              {report.item.sku ? ` (${report.item.sku})` : ''}
            </h1>
            <p className="text-sm text-muted-foreground">
              {`${report.dateFrom} — ${report.dateTo}`}
              {report.warehouseName ? ` · ${report.warehouseName}` : ''}
            </p>
          </div>

          {/* KPI row 1 — stock */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={t('kpis.openingQty')}
              value={fmtQty(report.opening.quantity)}
              sub={t('kpis.asOf', { date: report.dateFrom })}
            />
            <KpiCard
              label={t('kpis.purchasedQty')}
              value={fmtQty(kpis.purchasedQty - kpis.purchaseReturnedQty)}
              sub={
                kpis.purchaseReturnedQty > 0
                  ? t('kpis.returnedSuffix', { qty: fmtQty(kpis.purchaseReturnedQty) })
                  : undefined
              }
            />
            <KpiCard
              label={t('kpis.soldQty')}
              value={fmtQty(kpis.soldQty - kpis.salesReturnedQty)}
              sub={
                kpis.salesReturnedQty > 0
                  ? t('kpis.returnedSuffix', { qty: fmtQty(kpis.salesReturnedQty) })
                  : undefined
              }
            />
            <KpiCard
              label={t('kpis.onHand')}
              value={fmtQty(report.closing.onHandQuantity)}
              sub={t('kpis.stockValue', { value: nf.format(report.closing.stockValue) })}
              valueClassName={report.closing.onHandQuantity <= 0 ? 'text-red-600' : undefined}
            />
          </div>

          {/* KPI row 2 — money */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={t('kpis.revenue')}
              value={nf.format(kpis.revenue)}
              sub={t('kpis.fromInvoices', { count: kpis.salesInvoiceCount })}
            />
            <KpiCard
              label={t('kpis.cogs')}
              value={nf.format(kpis.cogs)}
              badge={kpis.cogsIsEstimated ? t('kpis.estimated') : undefined}
              sub={kpis.cogsIsEstimated ? t('kpis.estimatedHint') : undefined}
            />
            <KpiCard
              label={t('kpis.grossProfit')}
              value={nf.format(kpis.grossProfit)}
              valueClassName={kpis.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}
              sub={
                kpis.marginPercent === null
                  ? undefined
                  : t('kpis.margin', { percent: nf.format(kpis.marginPercent) })
              }
              badge={kpis.cogsIsEstimated ? t('kpis.estimated') : undefined}
            />
            <KpiCard
              label={t('kpis.priceSpread')}
              value={`${fmtMoney(kpis.avgSellPrice)} / ${fmtMoney(kpis.avgPurchaseCost)}`}
              sub={t('kpis.priceSpreadHint')}
            />
          </div>

          {/* Reconciliation strip */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                <span className="text-muted-foreground">{t('recon.opening')}</span>
                <span className="font-mono font-semibold">
                  {fmtQty(report.opening.quantity)}
                </span>
                <span className="text-muted-foreground">+</span>
                <span className="text-muted-foreground">{t('recon.in')}</span>
                <span className="font-mono font-semibold text-green-600">
                  {fmtQty(kpis.totalIn)}
                </span>
                <span className="text-muted-foreground">−</span>
                <span className="text-muted-foreground">{t('recon.out')}</span>
                <span className="font-mono font-semibold text-red-600">
                  {fmtQty(kpis.totalOut)}
                </span>
                <span className="text-muted-foreground">=</span>
                <span className="text-muted-foreground">{t('recon.closing')}</span>
                <span className="font-mono font-semibold">{fmtQty(report.closing.quantity)}</span>

                {report.closing.reconciles ? (
                  <span className="flex items-center gap-1 text-green-600 ms-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {t('recon.matches')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 ms-2">
                    <AlertTriangle className="h-4 w-4" />
                    {t('recon.mismatch', {
                      onHand: fmtQty(report.closing.onHandQuantity),
                    })}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Secondary insights */}
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InsightItem
                  label={t('insights.purchaseSpend')}
                  value={nf.format(kpis.purchaseCost)}
                />
                <InsightItem
                  label={t('insights.invoices')}
                  value={`${kpis.salesInvoiceCount} / ${kpis.purchaseInvoiceCount}`}
                />
                <InsightItem
                  label={t('insights.parties')}
                  value={`${kpis.distinctCustomers} / ${kpis.distinctSuppliers}`}
                />
                <InsightItem
                  label={t('insights.priceRange')}
                  value={`${fmtMoney(kpis.minSellPrice)} — ${fmtMoney(kpis.maxSellPrice)}`}
                />
                <InsightItem
                  label={t('insights.lastSold')}
                  value={kpis.lastSoldAt ? fmtDate(kpis.lastSoldAt) : '—'}
                />
                <InsightItem
                  label={t('insights.lastPurchased')}
                  value={kpis.lastPurchasedAt ? fmtDate(kpis.lastPurchasedAt) : '—'}
                />
                <InsightItem
                  label={t('insights.daysOfStock')}
                  value={kpis.daysOfStock === null ? '—' : qf.format(kpis.daysOfStock)}
                />
                <InsightItem
                  label={t('insights.turnover')}
                  value={kpis.turnover === null ? '—' : nf.format(kpis.turnover)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Kind filter (excluded from print) */}
          <div className="flex items-center gap-1 print:hidden">
            {(['all', 'sales', 'purchases'] as const).map((kind) => (
              <Button
                key={kind}
                type="button"
                size="sm"
                variant={kindFilter === kind ? 'default' : 'outline'}
                onClick={() => setKindFilter(kind)}
              >
                {t(`filters.${kind}`)}
              </Button>
            ))}
          </div>

          {/* Ledger */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.date')}</TableHead>
                    <TableHead>{t('table.type')}</TableHead>
                    <TableHead>{t('table.reference')}</TableHead>
                    <TableHead>{t('table.party')}</TableHead>
                    <TableHead>{t('table.warehouse')}</TableHead>
                    <TableHead className="text-right">{t('table.in')}</TableHead>
                    <TableHead className="text-right">{t('table.out')}</TableHead>
                    <TableHead className="text-right">{t('table.unitPrice')}</TableHead>
                    <TableHead className="text-right">{t('table.discount')}</TableHead>
                    <TableHead className="text-right">{t('table.net')}</TableHead>
                    <TableHead className="text-right">{t('table.balance')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening balance banner row */}
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={10} className="font-medium">
                      {t('table.openingBalance', { date: report.dateFrom })}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {fmtQty(report.opening.quantity)}
                    </TableCell>
                  </TableRow>

                  {visibleRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={11}
                        className="text-center py-12 text-muted-foreground"
                      >
                        {t('table.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleRows.map((row) => {
                      const clickable = !NON_INVOICE_TYPES.includes(row.movementType);
                      return (
                        <TableRow
                          key={row.id}
                          className={clickable ? 'cursor-pointer' : 'cursor-default'}
                          role={clickable ? 'link' : undefined}
                          tabIndex={clickable ? 0 : undefined}
                          onClick={clickable ? () => openInvoice(row) : undefined}
                          onKeyDown={
                            clickable
                              ? (e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openInvoice(row);
                                  }
                                }
                              : undefined
                          }
                          onMouseEnter={
                            clickable && row.invoiceId
                              ? () => prefetchInvoice(row.invoiceId!)
                              : undefined
                          }
                          onFocus={
                            clickable && row.invoiceId
                              ? () => prefetchInvoice(row.invoiceId!)
                              : undefined
                          }
                        >
                          <TableCell className="whitespace-nowrap">
                            {fmtDate(row.date)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn('whitespace-nowrap', BADGE_CLASSES[row.movementType])}
                            >
                              {t(`types.${row.movementType}`)}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-medium">
                            {row.invoiceNumber ?? '—'}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate">
                            {row.partyName ?? '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {row.movementType === 'transfer_in' ||
                            row.movementType === 'transfer_out' ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <ArrowRightLeft className="h-3 w-3" />
                                {row.notes ?? row.warehouseName ?? '—'}
                              </span>
                            ) : (
                              (row.warehouseName ?? '—')
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {row.quantityIn > 0 ? fmtQty(row.quantityIn) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {row.quantityOut > 0 ? fmtQty(row.quantityOut) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {fmtMoney(row.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.discountPercent ? `${nf.format(row.discountPercent)}%` : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {fmtMoney(row.lineNet)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-right font-mono font-semibold',
                              row.runningBalance < 0 && 'text-red-600'
                            )}
                          >
                            {fmtQty(row.runningBalance)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="font-semibold">
                      {t('table.totals')}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-green-600">
                      {fmtQty(visibleTotals.qtyIn)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-red-600">
                      {fmtQty(visibleTotals.qtyOut)}
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right font-mono font-semibold">
                      {nf.format(visibleTotals.net)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {fmtQty(report.closing.quantity)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
