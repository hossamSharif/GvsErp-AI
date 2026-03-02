/**
 * Dashboard Layout (Server Component)
 *
 * Forces dynamic rendering to prevent SSG prerender failures
 * from useAuth. Delegates all client logic to DashboardShell.
 */

import { type ReactNode } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
