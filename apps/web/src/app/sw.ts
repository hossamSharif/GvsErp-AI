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
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// ---------------------------------------------------------------------------
// 30-day offline resilience
//
// serwist's `defaultCache` expires app JS, page documents and RSC payloads
// after ~24h (`maxAgeSeconds: 1440 * 60`). That's fine for a normal PWA but
// breaks a *cold* offline launch after a day without a connection — the shell
// can't boot because its code/pages have been evicted. Business data lives in
// IndexedDB (no TTL) and is unaffected; only these HTTP caches need extending.
//
// These rules mirror the default matchers but with a 30-day TTL, refreshed on
// each use (`maxAgeFrom: 'last-used'`) so active use keeps them alive. They are
// listed BEFORE `...defaultCache` so they win (routing is first-match). Distinct
// cache names keep them isolated from the default (shorter-lived) caches.
// ---------------------------------------------------------------------------
const THIRTY_DAYS = 30 * 24 * 60 * 60;
const longLived = (maxEntries: number) =>
  new ExpirationPlugin({ maxEntries, maxAgeSeconds: THIRTY_DAYS, maxAgeFrom: 'last-used' });

const notApi = (pathname: string) => !pathname.startsWith('/api/');

const offlineFirstCaching: RuntimeCaching[] = [
  // Hashed, immutable app JS chunks — required to boot the UI offline.
  {
    matcher: /\/_next\/static.+\.js$/i,
    handler: new CacheFirst({ cacheName: 'offline-next-js', plugins: [longLived(512)] }),
  },
  {
    matcher: /\.js$/i,
    handler: new StaleWhileRevalidate({ cacheName: 'offline-js', plugins: [longLived(256)] }),
  },
  {
    matcher: /\.(?:css|less)$/i,
    handler: new StaleWhileRevalidate({ cacheName: 'offline-css', plugins: [longLived(64)] }),
  },
  {
    matcher: /\.(?:woff|woff2|ttf|otf|eot)$/i,
    handler: new CacheFirst({ cacheName: 'offline-fonts', plugins: [longLived(32)] }),
  },
  {
    matcher: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
    handler: new StaleWhileRevalidate({ cacheName: 'offline-images', plugins: [longLived(128)] }),
  },
  {
    matcher: /\/_next\/image\?url=.+$/i,
    handler: new StaleWhileRevalidate({ cacheName: 'offline-next-image', plugins: [longLived(128)] }),
  },
  // Full page navigations — the /{locale} document a cold offline launch boots.
  {
    matcher: ({ request, url, sameOrigin }) =>
      request.mode === 'navigate' && sameOrigin && notApi(url.pathname),
    handler: new NetworkFirst({ cacheName: 'offline-pages', plugins: [longLived(64)] }),
  },
  // RSC payloads — client-side navigation between already-visited pages.
  {
    matcher: ({ request, url, sameOrigin }) =>
      request.headers.get('RSC') === '1' && sameOrigin && notApi(url.pathname),
    handler: new NetworkFirst({ cacheName: 'offline-rsc', plugins: [longLived(128)] }),
  },
];

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
    // 30-day rules win over defaultCache's 24h equivalents (first match wins).
    ...offlineFirstCaching,
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      // A cold offline launch that lands on "/" (the next-intl locale redirect,
      // which can't run offline) boots the precached shell instead of dying.
      // The shell then hands off to the runtime-cached /{locale} dashboard.
      // Scoped to "/" only so a handoff to an uncached page can't loop back here.
      //
      // NOTE: a fallback matcher runs from serwist's `handlerDidError` plugin
      // hook, which passes ONLY { error, event, request } — there is no `url`.
      // Derive the path from `request.url`; referencing a `url` arg here throws
      // and silently kills the whole fallback (→ raw ERR_FAILED).
      {
        url: '/app-shell.html',
        matcher({ request }) {
          return request.mode === 'navigate' && new URL(request.url).pathname === '/';
        },
      },
      // Any other uncached document navigation shows the "reconnect" page.
      {
        url: '/offline.html',
        matcher({ request }) {
          return request.mode === 'navigate';
        },
      },
    ],
  },
});

serwist.addEventListeners();
