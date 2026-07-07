'use client';

/**
 * User Daily Summary Page
 *
 * Per-user comparison of sales, purchases, cash/bank payments and expenses
 * for a day or range. NOT real shift tracking (no clock-in/out exists) —
 * this is a per-user, per-day breakdown built from existing created_by
 * columns on invoices/payments/expenses.
 */

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useReactToPrint } from 'react-to-print';
import { useUserDailySummary } from '@/hooks/use-accounting';
import type { UserSummaryRow } from '@/hooks/use-accounting';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Loader2, UsersRound, ChevronLeft, ChevronRight, Printer } from 'lucide-react';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

type SortKey = 'userName' | 'sales' | 'purchases' | 'expenses' | 'net';

export default function UserDailySummaryPage() {
  const t = useTranslations('userDailySummary');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [sortKey, setSortKey] = useState<SortKey>('userName');
  const [sortAsc, setSortAsc] = useState(true);

  const { data, isLoading } = useUserDailySummary(startDate, endDate);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `User-Daily-Summary-${startDate}_${endDate}`,
    pageStyle: '@page { size: A4 landscape; margin: 10mm 12mm; }',
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

  const isSingleDay = startDate === endDate;
  const banks = data?.banks ?? [];
  /** Multiple bank accounts in play: break Bank In/Out into one column per bank instead of one lumped column. */
  const showPerBankColumns = banks.length > 1;

  const shiftBoth = (days: number) => {
    setStartDate((d) => shiftDay(d, days));
    setEndDate((d) => shiftDay(d, days));
  };

  const goToday = () => {
    setStartDate(todayIso());
    setEndDate(todayIso());
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((a) => !a);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortedRows: UserSummaryRow[] = useMemo(() => {
    const rows = data?.rows ?? [];
    const unknownLast = [...rows].filter((r) => r.userId !== 'unknown');
    const unknown = rows.find((r) => r.userId === 'unknown');

    const dir = sortAsc ? 1 : -1;
    unknownLast.sort((a, b) => {
      switch (sortKey) {
        case 'userName':
          return a.userName.localeCompare(b.userName) * dir;
        case 'sales':
          return (a.sales.amount - b.sales.amount) * dir;
        case 'purchases':
          return (a.purchases.amount - b.purchases.amount) * dir;
        case 'expenses':
          return (a.expenses.amount - b.expenses.amount) * dir;
        case 'net':
          return (a.net - b.net) * dir;
        default:
          return 0;
      }
    });

    return unknown ? [...unknownLast, unknown] : unknownLast;
  }, [data, sortKey, sortAsc]);

  return (
    <div className="space-y-6">
      <UserDailySummaryPrintStyles />

      {/* Controls (excluded from print) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UsersRound className="h-6 w-6" /> {t('title')}
          </h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1">
            <Label htmlFor="uds-start">{t('startDate')}</Label>
            <Input
              id="uds-start"
              type="date"
              className="w-40"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="uds-end">{t('endDate')}</Label>
            <Input
              id="uds-end"
              type="date"
              className="w-40"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {isSingleDay && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('prevDay')}
                onClick={() => shiftBoth(-1)}
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('nextDay')}
                onClick={() => shiftBoth(1)}
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          )}
          <Button type="button" variant="outline" onClick={goToday}>
            {t('today')}
          </Button>
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
        <div ref={printRef} className="user-daily-summary-print-root space-y-4">
          <div className="hidden print:block">
            <h1 className="text-xl font-bold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">
              {data.startDate === data.endDate
                ? data.startDate
                : `${data.startDate} — ${data.endDate}`}
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              {sortedRows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">{t('empty')}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label={t('columns.user')} sortKey="userName" active={sortKey} asc={sortAsc} onClick={toggleSort} />
                      <SortableHead label={t('columns.sales')} sortKey="sales" active={sortKey} asc={sortAsc} onClick={toggleSort} align="right" />
                      <SortableHead label={t('columns.purchases')} sortKey="purchases" active={sortKey} asc={sortAsc} onClick={toggleSort} align="right" />
                      <TableHead className="text-right">{t('columns.cashIn')}</TableHead>
                      {showPerBankColumns ? (
                        banks.map((b) => (
                          <TableHead key={`in-${b.id}`} className="text-right">
                            {t('columns.bankInNamed', { name: b.name })}
                          </TableHead>
                        ))
                      ) : (
                        <TableHead className="text-right">{t('columns.bankIn')}</TableHead>
                      )}
                      <TableHead className="text-right">{t('columns.cashOut')}</TableHead>
                      {showPerBankColumns ? (
                        banks.map((b) => (
                          <TableHead key={`out-${b.id}`} className="text-right">
                            {t('columns.bankOutNamed', { name: b.name })}
                          </TableHead>
                        ))
                      ) : (
                        <TableHead className="text-right">{t('columns.bankOut')}</TableHead>
                      )}
                      <SortableHead label={t('columns.expenses')} sortKey="expenses" active={sortKey} asc={sortAsc} onClick={toggleSort} align="right" />
                      <SortableHead label={t('columns.net')} sortKey="net" active={sortKey} asc={sortAsc} onClick={toggleSort} align="right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((row) => (
                      <TableRow key={row.userId}>
                        <TableCell className="text-sm">
                          {row.userId === 'unknown' ? t('unknownUser') : row.userName}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {nf.format(row.sales.amount)}
                          <span className="text-muted-foreground text-xs ms-1">({row.sales.count})</span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {nf.format(row.purchases.amount)}
                          <span className="text-muted-foreground text-xs ms-1">({row.purchases.count})</span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {nf.format(row.paymentsReceived.cash.amount)}
                        </TableCell>
                        {showPerBankColumns ? (
                          banks.map((b) => (
                            <TableCell key={`in-${b.id}`} className="text-right font-mono">
                              {nf.format(row.paymentsReceived.byBank[b.id]?.amount ?? 0)}
                            </TableCell>
                          ))
                        ) : (
                          <TableCell className="text-right font-mono">
                            {nf.format(row.paymentsReceived.bank.amount)}
                          </TableCell>
                        )}
                        <TableCell className="text-right font-mono">
                          {nf.format(row.paymentsMade.cash.amount)}
                        </TableCell>
                        {showPerBankColumns ? (
                          banks.map((b) => (
                            <TableCell key={`out-${b.id}`} className="text-right font-mono">
                              {nf.format(row.paymentsMade.byBank[b.id]?.amount ?? 0)}
                            </TableCell>
                          ))
                        ) : (
                          <TableCell className="text-right font-mono">
                            {nf.format(row.paymentsMade.bank.amount)}
                          </TableCell>
                        )}
                        <TableCell className="text-right font-mono">
                          {nf.format(row.expenses.amount)}
                          <span className="text-muted-foreground text-xs ms-1">({row.expenses.count})</span>
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono font-medium ${
                            row.net >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {nf.format(row.net)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-medium">{t('columns.total')}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {nf.format(data.totals.sales.amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {nf.format(data.totals.purchases.amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {nf.format(data.totals.paymentsReceived.cash)}
                      </TableCell>
                      {showPerBankColumns ? (
                        banks.map((b) => (
                          <TableCell key={`in-total-${b.id}`} className="text-right font-mono font-medium">
                            {nf.format(data.totals.paymentsReceived.byBank[b.id] ?? 0)}
                          </TableCell>
                        ))
                      ) : (
                        <TableCell className="text-right font-mono font-medium">
                          {nf.format(data.totals.paymentsReceived.bank)}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-mono font-medium">
                        {nf.format(data.totals.paymentsMade.cash)}
                      </TableCell>
                      {showPerBankColumns ? (
                        banks.map((b) => (
                          <TableCell key={`out-total-${b.id}`} className="text-right font-mono font-medium">
                            {nf.format(data.totals.paymentsMade.byBank[b.id] ?? 0)}
                          </TableCell>
                        ))
                      ) : (
                        <TableCell className="text-right font-mono font-medium">
                          {nf.format(data.totals.paymentsMade.bank)}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-mono font-medium">
                        {nf.format(data.totals.expenses.amount)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-medium ${
                          data.totals.net >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {nf.format(data.totals.net)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SortableHead({
  label,
  sortKey,
  active,
  asc,
  onClick,
  align,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  asc: boolean;
  onClick: (key: SortKey) => void;
  align?: 'right';
}) {
  const isActive = active === sortKey;
  return (
    <TableHead
      className={`cursor-pointer select-none ${align === 'right' ? 'text-right' : ''}`}
      onClick={() => onClick(sortKey)}
    >
      {label}
      {isActive && <span className="ms-1">{asc ? '▲' : '▼'}</span>}
    </TableHead>
  );
}

/**
 * Scoped print stylesheet — hide-all / show-print-root trick (mirrors the
 * Daily Journal / invoice print styles), landscape A4 to fit the wide table.
 */
function UserDailySummaryPrintStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
@media print {
  html, body { background: #fff !important; }
  body * { visibility: hidden; }
  .user-daily-summary-print-root, .user-daily-summary-print-root * { visibility: visible; }
  .user-daily-summary-print-root {
    position: absolute;
    inset: 0;
    box-shadow: none !important;
    margin: 0 !important;
  }
  .user-daily-summary-print-root, .user-daily-summary-print-root * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  .user-daily-summary-print-root thead { display: table-header-group; }
  .user-daily-summary-print-root tfoot { display: table-footer-group; }
  .user-daily-summary-print-root tr { page-break-inside: avoid; }
}
        `.trim(),
      }}
    />
  );
}
