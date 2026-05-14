/**
 * Accounting Layout (Phase 9)
 *
 * Renders the accounting sub-nav above every page under /accounting/*.
 * The parent (dashboard) layout already provides page padding; the
 * sub-nav uses negative margin to bleed to the padded edges.
 */

import { type ReactNode } from 'react';
import { AccountingSubNav } from '@/components/accounting/accounting-subnav';

export default function AccountingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AccountingSubNav />
      {children}
    </>
  );
}
