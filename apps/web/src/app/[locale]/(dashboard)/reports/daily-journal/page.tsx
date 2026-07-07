'use client';

/**
 * Daily Journal Page
 *
 * A deliberately simple, printable daily snapshot for owners/managers:
 * headline KPIs, current cash & bank balances, and the day's sales,
 * purchases and expenses as compact lists. NOT the double-entry day book —
 * this trades accounting rigour for at-a-glance readability.
 */

import { useState, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useReactToPrint } from 'react-to-print';
import { useDailyJournal } from '@/hooks/use-accounting';
import type {
  DailyJournalInvoiceItem,
  DailyJournalExpenseItem,
} from '@/hooks/use-accounting';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Printer,
} from 'lucide-react';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function DailyJournalPage() {
  const t = useTranslations('dailyJournal');
  const [date, setDate] = useState(todayIso());
  const { data, isLoading } = useDailyJournal(date);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Daily-Journal-${date}`,
    pageStyle: '@page { size: A4; margin: 12mm 14mm; }',
    removeAfterPrint: true,
  });

  const nf = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const netPositive = (data?.kpis.netCashFlow ?? 0) >= 0;

  return (
    <div className="space-y-6">
      <DailyJournalPrintStyles />

      {/* Controls (excluded from print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> {t('title')}
          </h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="dj-date">{t('date')}</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('prevDay')}
                onClick={() => setDate((d) => shiftDay(d, -1))}
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <Input
                id="dj-date"
                type="date"
                className="w-40"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('nextDay')}
                onClick={() => setDate((d) => shiftDay(d, 1))}
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDate(todayIso())}
              >
                {t('today')}
              </Button>
            </div>
          </div>
          <Button type="button" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> {t('print')}
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div ref={printRef} className="daily-journal-print-root space-y-6">
          {/* Print-only heading */}
          <div className="hidden print:block">
            <h1 className="text-xl font-bold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{data.date}</p>
          </div>

          {/* KPI cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <KpiCard label={t('kpis.sales')} value={nf.format(data.kpis.totalSales)} />
            <KpiCard
              label={t('kpis.purchases')}
              value={nf.format(data.kpis.totalPurchases)}
            />
            <KpiCard
              label={t('kpis.expenses')}
              value={nf.format(data.kpis.totalExpenses)}
            />
            <KpiCard
              label={t('kpis.netCashFlow')}
              value={nf.format(data.kpis.netCashFlow)}
              valueClassName={netPositive ? 'text-green-600' : 'text-red-600'}
            />
          </div>

          {/* Balances */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t('balances.title')}
                <span className="ms-2 text-xs font-normal text-muted-foreground">
                  ({t('balances.asOfNote')})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-3">
                <BalanceItem label={t('balances.cash')} value={nf.format(data.balances.cash)} />
                <BalanceItem label={t('balances.bank')} value={nf.format(data.balances.bank)} />
                <BalanceItem
                  label={t('balances.totalLiquid')}
                  value={nf.format(data.balances.totalLiquid)}
                  emphasize
                />
              </div>
              {data.balances.banks.length > 1 && (
                <div className="mt-4 pt-4 border-t space-y-1">
                  <p className="text-xs text-muted-foreground">{t('balances.perBank')}</p>
                  {data.balances.banks.map((b) => (
                    <div key={b.id} className="flex items-center justify-between text-sm">
                      <span>{b.name}</span>
                      <span className="font-mono">{nf.format(b.balance)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sales */}
          <InvoiceSection
            title={t('sections.sales')}
            items={data.sales.items}
            total={data.sales.total}
            emptyLabel={t('empty.sales')}
            numberLabel={t('columns.number')}
            partyLabel={t('columns.party')}
            amountLabel={t('columns.amount')}
            totalLabel={t('columns.total')}
            format={nf.format}
          />

          {/* Purchases */}
          <InvoiceSection
            title={t('sections.purchases')}
            items={data.purchases.items}
            total={data.purchases.total}
            emptyLabel={t('empty.purchases')}
            numberLabel={t('columns.number')}
            partyLabel={t('columns.party')}
            amountLabel={t('columns.amount')}
            totalLabel={t('columns.total')}
            format={nf.format}
          />

          {/* Expenses */}
          <ExpenseSection
            title={t('sections.expenses')}
            items={data.expenses.items}
            total={data.expenses.total}
            emptyLabel={t('empty.expenses')}
            categoryLabel={t('columns.category')}
            descriptionLabel={t('columns.description')}
            amountLabel={t('columns.amount')}
            totalLabel={t('columns.total')}
            format={nf.format}
          />
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold font-mono ${valueClassName ?? ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function BalanceItem({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`font-mono ${emphasize ? 'text-xl font-bold' : 'text-lg font-semibold'}`}
      >
        {value}
      </p>
    </div>
  );
}

function InvoiceSection({
  title,
  items,
  total,
  emptyLabel,
  numberLabel,
  partyLabel,
  amountLabel,
  totalLabel,
  format,
}: {
  title: string;
  items: DailyJournalInvoiceItem[];
  total: number;
  emptyLabel: string;
  numberLabel: string;
  partyLabel: string;
  amountLabel: string;
  totalLabel: string;
  format: (n: number) => string;
}) {
  return (
    <Card className="avoid-break">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">{emptyLabel}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{numberLabel}</TableHead>
                <TableHead>{partyLabel}</TableHead>
                <TableHead className="text-right">{amountLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-mono text-sm">{it.number}</TableCell>
                  <TableCell className="text-sm">{it.party || '-'}</TableCell>
                  <TableCell className="text-right font-mono">{format(it.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  {totalLabel}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {format(total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ExpenseSection({
  title,
  items,
  total,
  emptyLabel,
  categoryLabel,
  descriptionLabel,
  amountLabel,
  totalLabel,
  format,
}: {
  title: string;
  items: DailyJournalExpenseItem[];
  total: number;
  emptyLabel: string;
  categoryLabel: string;
  descriptionLabel: string;
  amountLabel: string;
  totalLabel: string;
  format: (n: number) => string;
}) {
  return (
    <Card className="avoid-break">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">{emptyLabel}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{categoryLabel}</TableHead>
                <TableHead>{descriptionLabel}</TableHead>
                <TableHead className="text-right">{amountLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="text-sm">{it.category || '-'}</TableCell>
                  <TableCell className="text-sm">{it.description || '-'}</TableCell>
                  <TableCell className="text-right font-mono">{format(it.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  {totalLabel}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {format(total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Scoped print stylesheet — hide-all / show-print-root trick (mirrors the
 * invoice print styles), A4, RTL-aware via the app's existing dir handling.
 */
function DailyJournalPrintStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
@media print {
  html, body { background: #fff !important; }
  body * { visibility: hidden; }
  .daily-journal-print-root, .daily-journal-print-root * { visibility: visible; }
  .daily-journal-print-root {
    position: absolute;
    inset: 0;
    box-shadow: none !important;
    margin: 0 !important;
  }
  .daily-journal-print-root, .daily-journal-print-root * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  .daily-journal-print-root thead { display: table-header-group; }
  .daily-journal-print-root tfoot { display: table-footer-group; }
  .daily-journal-print-root tr,
  .daily-journal-print-root .avoid-break { page-break-inside: avoid; }
}
        `.trim(),
      }}
    />
  );
}
