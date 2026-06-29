'use client';

/**
 * useOnline
 *
 * Reactive connectivity state driven by the browser online/offline events.
 * Used to gate online-only modules (accounting, HR) and to show sync status.
 */

import { useEffect, useState } from 'react';

export function useOnline(): boolean {
  // Default to true so SSR/first paint assumes connectivity; corrected on mount.
  const [online, setOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
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
