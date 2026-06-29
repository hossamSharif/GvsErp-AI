'use client';

/**
 * TanStack Query Provider
 *
 * Provides React Query context and persists the query cache to IndexedDB so
 * previously-fetched data is available instantly on reload and while offline.
 * Dexie remains the canonical offline store (see lib/offline); this persisted
 * cache is for fast first paint and offline read continuity.
 */

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { get, set, del } from 'idb-keyval';
import { useState, type ReactNode } from 'react';

const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function createPersister() {
  return createAsyncStoragePersister({
    key: 'erp-query-cache',
    // idb-keyval backs an AsyncStorage interface for the persister.
    storage: {
      getItem: (key) => get(key).then((v) => v ?? null),
      setItem: (key, value) => set(key, value),
      removeItem: (key) => del(key),
    },
    throttleTime: 1000,
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: CACHE_MAX_AGE, // keep long enough to persist for offline
            // Pause (don't error) when offline; show cached data instead.
            networkMode: 'offlineFirst',
            retry: (failureCount, error) => {
              if (error instanceof Error && 'status' in error) {
                const status = (error as { status: number }).status;
                if (status >= 400 && status < 500) {
                  return false;
                }
              }
              return failureCount < 3;
            },
            refetchOnWindowFocus: false,
          },
          mutations: {
            networkMode: 'offlineFirst',
            onError: (error) => {
              console.error('Mutation error:', error);
            },
          },
        },
      })
  );

  // Persister is browser-only; created once.
  const [persister] = useState(() =>
    typeof window === 'undefined' ? null : createPersister()
  );

  if (!persister) {
    // SSR / no-window: render children without persistence.
    return <>{children}</>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE }}
    >
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </PersistQueryClientProvider>
  );
}
