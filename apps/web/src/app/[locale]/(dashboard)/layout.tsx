'use client';

/**
 * Dashboard Layout
 *
 * Main application layout with sidebar and header.
 * Includes auth protection and responsive design.
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { useDirection } from '@/stores/language-store';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AIPanel } from '@/components/ai/ai-panel';
import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const { user, session, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { direction, isRtl } = useDirection();
  const locale = params.locale as string;
  const [authChecked, setAuthChecked] = useState(false);

  // Redirect to login if not authenticated (with delay to ensure auth state is loaded)
  useEffect(() => {
    if (isLoading) return;

    // Give more time for session to fully propagate from cookies
    const timer = setTimeout(() => {
      setAuthChecked(true);
      if (!user && !session) {
        router.push(`/${locale}/login`);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [user, session, isLoading, router, locale]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [children]);

  // Show loading state
  if (isLoading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user && !session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background" dir={direction}>
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
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

        <main className="p-4 md:p-6">{children}</main>
      </div>

      {/* AI Assistant Panel */}
      <AIPanel />
    </div>
  );
}
