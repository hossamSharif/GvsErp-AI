/**
 * Reports Layout
 *
 * Renders the reports sub-nav above every page under /reports/*.
 * The parent (dashboard) layout already provides page padding; the
 * sub-nav uses negative margin to bleed to the padded edges.
 */

import { type ReactNode } from 'react';
import { ReportsSubNav } from '@/components/reports/reports-subnav';
import { OnlineOnlyGuard } from '@/components/pwa/online-only-guard';

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <OnlineOnlyGuard moduleName="Reports">
      <ReportsSubNav />
      {children}
    </OnlineOnlyGuard>
  );
}
