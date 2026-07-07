'use client';

/**
 * Reports Sub-Nav
 *
 * Horizontal tabs under /reports/* so Daily Journal and User Daily Summary
 * are reachable from a single "Reports" sidebar entry, mirroring the
 * accounting sub-nav pattern (see accounting-subnav.tsx). Reuses the
 * existing `nav` translation keys for tab labels — no separate subnav
 * i18n namespace needed for just two tabs.
 *
 * RTL-safe: uses logical properties, no left/right-only spacing.
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  labelKey: string;
}

export function ReportsSubNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { locale } = useParams();
  const localeStr = locale as string;

  const tabs: NavItem[] = useMemo(
    () => [
      { href: `/${localeStr}/reports/daily-journal`, labelKey: 'dailyJournal' },
      { href: `/${localeStr}/reports/user-daily-summary`, labelKey: 'userDailySummary' },
    ],
    [localeStr]
  );

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav aria-label={t('reports')} className="border-b mb-6 -mx-4 md:-mx-6 px-4 md:px-6">
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
      </div>
    </nav>
  );
}
