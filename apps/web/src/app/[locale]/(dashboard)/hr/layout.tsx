/**
 * HR Layout
 *
 * HR (employees, attendance, payroll) is online-only — its data is not mirrored
 * for offline use. The guard shows a "connect to continue" panel when offline.
 */

import { type ReactNode } from 'react';
import { OnlineOnlyGuard } from '@/components/pwa/online-only-guard';

export default function HrLayout({ children }: { children: ReactNode }) {
  return <OnlineOnlyGuard moduleName="HR">{children}</OnlineOnlyGuard>;
}
