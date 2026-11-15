'use client';

/**
 * Local edition first-run state.
 *
 * Returns whether this install still needs its one-time setup (company +
 * owner account). In the cloud it never does, and no request is made.
 */

import { useEffect, useState } from 'react';
import { isLocalMode } from '@/lib/runtime-config';

export type SetupState = 'unknown' | 'needs-setup' | 'ready';

export function useSetupStatus(): SetupState {
  const [state, setState] = useState<SetupState>(() => (isLocalMode() ? 'unknown' : 'ready'));

  useEffect(() => {
    if (!isLocalMode()) return;
    let cancelled = false;
    fetch('/api/v1/auth/setup-status')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { data?: { needsSetup?: boolean } }) => {
        if (!cancelled) setState(body.data?.needsSetup ? 'needs-setup' : 'ready');
      })
      // If the check fails, fall back to the normal login screen.
      .catch(() => !cancelled && setState('ready'));
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
