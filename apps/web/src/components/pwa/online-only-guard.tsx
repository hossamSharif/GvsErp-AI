'use client';

/**
 * Online-Only Guard
 *
 * Gates modules that are NOT available offline (accounting, HR). While offline,
 * it renders a "connect to continue" panel instead of the module. These modules
 * still RECEIVE deferred postings when offline operational work syncs — the
 * restriction is UI-only, not a data-integrity boundary.
 */

import { CloudOff } from 'lucide-react';
import { type ReactNode } from 'react';
import { useOnline } from '@/hooks/use-online';

interface OnlineOnlyGuardProps {
  children: ReactNode;
  /** Module name shown in the offline message. */
  moduleName?: string;
}

export function OnlineOnlyGuard({ children, moduleName = 'This module' }: OnlineOnlyGuardProps) {
  const online = useOnline();

  if (online) return <>{children}</>;

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <CloudOff className="h-10 w-10 text-muted-foreground" />
      <h2 className="text-lg font-semibold">{moduleName} needs a connection</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {moduleName} is available online only. Your offline sales, purchases, payments and
        inventory changes are saved locally and will post here automatically once you reconnect.
      </p>
    </div>
  );
}
