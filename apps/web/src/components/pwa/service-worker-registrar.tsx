'use client';

/**
 * Service Worker Registrar
 *
 * Registers the Serwist service worker only AFTER the first online login, so a
 * brand-new user (no synced data) is never served an empty offline shell. Once
 * registered, the SW precaches the app shell and persists across sessions, so
 * later offline launches load the UI and login screen with no network.
 */

import { useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useOnline } from '@/hooks/use-online';

export function ServiceWorkerRegistrar() {
  const { session } = useAuth();
  const online = useOnline();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // SW is disabled in development (see next.config.mjs) — nothing to register.
    if (process.env.NODE_ENV === 'development') return;
    // Only after the user has authenticated online at least once.
    if (!session || !online) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('[pwa] service worker registration failed', err));
  }, [session, online]);

  return null;
}
