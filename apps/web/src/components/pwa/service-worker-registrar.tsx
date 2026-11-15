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
import { isLocalMode } from '@/lib/runtime-config';

export function ServiceWorkerRegistrar() {
  const { session } = useAuth();
  const online = useOnline();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // SW is disabled in development (see next.config.mjs) — nothing to register.
    if (process.env.NODE_ENV === 'development') return;
    // Local edition: no offline shell needed (server is on this PC), and a
    // cached shell would outlive app updates.
    if (isLocalMode()) return;
    // Only after the user has authenticated online at least once, so a brand-new
    // user is never trapped in an empty offline shell before any data has synced.
    if (!session || !online) return;

    let cancelled = false;

    // Register after the page has loaded so precaching doesn't compete with
    // first paint/hydration, and confirm the worker actually activates — the SW
    // must be in control before the user installs, or a cold offline launch has
    // no controller and dies to ERR_FAILED.
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(() => navigator.serviceWorker.ready)
        .then(() => {
          if (!cancelled) console.info('[pwa] service worker active — offline launch ready');
        })
        .catch((err) => console.warn('[pwa] service worker registration failed', err));
    };

    // Ask the browser to keep our caches + IndexedDB from being evicted under
    // storage pressure — important for the 30-day offline window (the cached app
    // shell/pages must survive weeks without a visit). Best-effort; ignored if
    // unsupported or denied.
    void navigator.storage?.persist?.().then((granted) => {
      if (!cancelled) console.info(`[pwa] persistent storage ${granted ? 'granted' : 'not granted'}`);
    }).catch(() => {});

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('load', register);
    };
  }, [session, online]);

  return null;
}
