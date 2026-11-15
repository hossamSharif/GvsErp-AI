'use client';

/**
 * Dashboard Shell (Client Component)
 *
 * Contains all client-side dashboard logic: auth protection,
 * sidebar state, responsive layout. Extracted from layout.tsx
 * so the layout can be a server component with dynamic rendering.
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { useDirection } from '@/hooks/use-direction';
import { useOnline } from '@/hooks/use-online';
import { useIdleSignOut } from '@/hooks/use-idle-sign-out';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Toaster } from '@/components/ui/toaster';
import { OfflineUnlock } from '@/components/pwa/offline-unlock';
import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

const OFFLINE_UNLOCK_KEY = 'erp-offline-unlocked';

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Local edition (shared PC): auto sign-out after inactivity. No-op in the cloud.
  useIdleSignOut();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { direction, isRtl } = useDirection();
  const online = useOnline();
  const locale = params.locale as string;

  // Offline PIN gate: null = still checking, true = PIN required, false = not.
  const [pinRequired, setPinRequired] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  // Redirect to login if not authenticated AND online. Offline we keep the
  // shell (the cached session / PIN governs access); /login needs the network.
  useEffect(() => {
    if (!isLoading && !user && online) {
      router.push(`/${locale}/login`);
    }
  }, [user, isLoading, online, router, locale]);

  // Decide whether an offline PIN unlock is needed.
  useEffect(() => {
    let active = true;
    (async () => {
      if (online || !user) {
        if (active) setPinRequired(false);
        return;
      }
      const alreadyUnlocked =
        typeof window !== 'undefined' &&
        sessionStorage.getItem(OFFLINE_UNLOCK_KEY) === '1';
      if (alreadyUnlocked) {
        if (active) {
          setUnlocked(true);
          setPinRequired(false);
        }
        return;
      }
      try {
        const { hasPin } = await import('@/lib/offline/auth-local');
        const need = await hasPin();
        if (active) setPinRequired(need);
      } catch {
        if (active) setPinRequired(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [online, user]);

  function handleUnlocked() {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(OFFLINE_UNLOCK_KEY, '1');
    }
    setUnlocked(true);
  }

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [children]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (online redirects to /login; offline we
  // wait for the cached session to hydrate rather than blank out).
  if (!user) {
    return null;
  }

  // Offline PIN gate: block the dashboard until unlocked.
  if (!online && pinRequired && !unlocked) {
    return <OfflineUnlock onUnlocked={handleUnlocked} />;
  }

  return (
    <div className="min-h-screen bg-background" dir={direction}>
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          aria-hidden="true"
          onClick={() => setMobileSidebarOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 z-50 lg:hidden transition-transform duration-300',
          isRtl ? 'right-0' : 'left-0',
          mobileSidebarOpen
            ? 'translate-x-0'
            : isRtl
            ? 'translate-x-full'
            : '-translate-x-full'
        )}
      >
        <Sidebar
          isCollapsed={false}
          onToggle={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* Desktop sidebar */}
      <div
        className={cn(
          'hidden lg:block fixed inset-y-0 z-30',
          isRtl ? 'right-0' : 'left-0'
        )}
      >
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Main content area */}
      <div
        className={cn(
          'min-h-screen transition-all duration-300',
          isRtl ? 'lg:mr-64' : 'lg:ml-64',
          sidebarCollapsed && (isRtl ? 'lg:mr-16' : 'lg:ml-16')
        )}
      >
        <Header onMenuClick={() => setMobileSidebarOpen(true)} />

        <main id="main-content" className="p-4 md:p-6">{children}</main>
      </div>

      <Toaster />
    </div>
  );
}
