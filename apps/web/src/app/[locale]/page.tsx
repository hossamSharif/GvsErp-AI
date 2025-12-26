'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';

export default function HomePage() {
  const { user, session, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  useEffect(() => {
    if (isLoading) return;

    // Redirect based on auth status
    if (user || session) {
      // Authenticated - go to dashboard (items page as default)
      router.replace(`/${locale}/items`);
    } else {
      // Not authenticated - go to login
      router.replace(`/${locale}/login`);
    }
  }, [user, session, isLoading, router, locale]);

  // Show loading while checking auth
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    </div>
  );
}
