/**
 * Auth Layout (Server Component)
 *
 * Forces dynamic rendering to prevent SSG prerender failures
 * from useAuth in login/register pages. Delegates UI to AuthShell.
 */

import { type ReactNode } from 'react';
import { AuthShell } from '@/components/layout/auth-shell';

export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
