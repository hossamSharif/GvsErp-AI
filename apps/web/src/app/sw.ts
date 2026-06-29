/// <reference lib="webworker" />

/**
 * Service worker (Serwist)
 *
 * Precaches the Next.js app shell so the UI (including the login screen) loads
 * with no network for returning users. API calls (`/api/v1/*`) are NEVER cached
 * here — the offline data path is IndexedDB (see lib/offline). Failed document
 * navigations fall back to the precached /offline.html shell.
 *
 * Compiled by @serwist/next, not by the app's tsc (excluded in tsconfig).
 */

import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // API traffic must always hit the network; offline data is served from
    // IndexedDB by the app transport, never from an HTTP cache.
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/'),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline.html',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

serwist.addEventListeners();
