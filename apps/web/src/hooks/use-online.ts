'use client';

/**
 * useOnline
 *
 * Reactive connectivity state driven by the browser online/offline events.
 * Used to gate online-only modules (accounting, HR) and to show sync status.
 */

import { useEffect, useState } from 'react';
import { isLocalMode } from '@/lib/runtime-config';

export function useOnline(): boolean {
  // Default to true so SSR/first paint assumes connectivity; corrected on mount.
  const [online, setOnline] = useState<boolean>(
    typeof navigator === 'undefined' || isLocalMode() ? true : navigator.onLine
  );

  useEffect(() => {
    // Local edition: the server runs on this PC, so the app is always "online"
    // even when the PC itself has no network (navigator.onLine is false then).
    if (isLocalMode()) return;
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
