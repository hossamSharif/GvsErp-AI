'use client';

/**
 * Accounting Sub-Nav (Phase 9)
 *
 * Horizontal tabs under /accounting/* so the pages added across P3-P8
 * (banks, cost centers, settings, six report pages) are discoverable.
 * The sidebar's "Accounting" entry still lands on /accounting/accounts —
 * this sub-nav takes over from there.
 *
 * RTL-safe: uses logical properties, no left/right-only spacing.
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

interface NavItem {
  href: string;
  labelKey: string;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

export function AccountingSubNav() {
  const t = useTranslations('accounting.subnav');
  const pathname = usePathname();
  const { locale } = useParams();
  const localeStr = locale as string;

  // Primary tabs and the "Reports" dropdown. Keeping reports collapsed
  // because there are nine of them and a flat row gets noisy.
  const tabs: NavItem[] = useMemo(
    () => [
      { href: `/${localeStr}/accounting/accounts`, labelKey: 'accounts' },
      { href: `/${localeStr}/accounting/journal`, labelKey: 'journal' },
      { href: `/${localeStr}/accounting/banks`, labelKey: 'banks' },
      { href: `/${localeStr}/accounting/cost-centers`, labelKey: 'costCenters' },
      { href: `/${localeStr}/accounting/settings`, labelKey: 'settings' },
    ],
    [localeStr]
  );

  const reportsGroup: NavGroup = useMemo(
    () => ({
      labelKey: 'reports',
      items: [
        { href: `/${localeStr}/accounting/trial-balance`, labelKey: 'trialBalance' },
        { href: `/${localeStr}/accounting/income-statement`, labelKey: 'incomeStatement' },
        { href: `/${localeStr}/accounting/balance-sheet`, labelKey: 'balanceSheet' },
        { href: `/${localeStr}/accounting/ledger`, labelKey: 'ledger' },
        { href: `/${localeStr}/accounting/reports/day-book`, labelKey: 'dayBook' },
        { href: `/${localeStr}/accounting/reports/aging-receivables`, labelKey: 'agingReceivables' },
        { href: `/${localeStr}/accounting/reports/aging-payables`, labelKey: 'agingPayables' },
        { href: `/${localeStr}/accounting/reports/stock-summary`, labelKey: 'stockSummary' },
        { href: `/${localeStr}/accounting/reports/cost-centers`, labelKey: 'costCenterTotals' },
      ],
    }),
    [localeStr]
  );

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const isReportsActive = reportsGroup.items.some((it) => isActive(it.href));

  return (
    <nav
      aria-label={t('label')}
      className="border-b mb-6 -mx-4 md:-mx-6 px-4 md:px-6"
    >
      <div className="flex items-center gap-1 overflow-x-auto py-2">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors',
              isActive(tab.href)
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {t(tab.labelKey)}
          </Link>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors',
              isReportsActive
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {t('reports')}
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {reportsGroup.items.map((it) => (
              <DropdownMenuItem key={it.href} asChild>
                <Link
                  href={it.href}
                  className={cn(
                    'w-full',
                    isActive(it.href) ? 'font-medium' : ''
                  )}
                >
                  {t(it.labelKey)}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
